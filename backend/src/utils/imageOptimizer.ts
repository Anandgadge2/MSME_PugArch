import sharp from 'sharp';
import crypto from 'crypto';

interface CachedImageEntry {
  buffer: Buffer;
  contentType: string;
  etag: string;
  size: number;
  lastAccessed: number;
}

// In-memory LRU Cache configuration
const MAX_CACHE_ITEMS = 300;
const MAX_CACHE_MEMORY_BYTES = 64 * 1024 * 1024; // 64 MB maximum RAM for hot images

const imageCache = new Map<string, CachedImageEntry>();
let currentCacheBytes = 0;

/**
 * Builds a deterministic cache key from the image path and transformation query parameters.
 */
export function buildImageCacheKey(key: string, query: Record<string, any> = {}): string {
  const w = parseInt(query.w as string) || 0;
  const h = parseInt(query.h as string) || 0;
  const q = Math.min(100, Math.max(1, parseInt(query.q as string) || 80));
  const fmt = (query.fmt as string || '').toLowerCase().trim();
  return `${key.trim()}?w=${w}&h=${h}&q=${q}&fmt=${fmt}`;
}

/**
 * Generates an HTTP ETag based on the MD5 digest of the image buffer.
 */
export function generateETag(buffer: Buffer): string {
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 24);
  return `"${hash}"`;
}

/**
 * Retrieves an optimized image buffer from the in-memory LRU cache if available.
 */
export function getImageFromCache(cacheKey: string): CachedImageEntry | null {
  const entry = imageCache.get(cacheKey);
  if (!entry) return null;

  // Update LRU access timestamp
  entry.lastAccessed = Date.now();
  return entry;
}

/**
 * Stores an image buffer in the LRU cache with automatic memory eviction.
 */
export function saveImageToCache(
  cacheKey: string,
  buffer: Buffer,
  contentType: string
): CachedImageEntry {
  const size = buffer.length;

  // If a single image is larger than 8MB, do not cache in memory to preserve headroom
  if (size > 8 * 1024 * 1024) {
    return {
      buffer,
      contentType,
      etag: generateETag(buffer),
      size,
      lastAccessed: Date.now(),
    };
  }

  // Evict if over item limit or memory threshold
  while (
    imageCache.size >= MAX_CACHE_ITEMS ||
    (currentCacheBytes + size > MAX_CACHE_MEMORY_BYTES && imageCache.size > 0)
  ) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [k, v] of imageCache.entries()) {
      if (v.lastAccessed < oldestTime) {
        oldestTime = v.lastAccessed;
        oldestKey = k;
      }
    }

    if (oldestKey) {
      const evicted = imageCache.get(oldestKey);
      if (evicted) {
        currentCacheBytes -= evicted.size;
        imageCache.delete(oldestKey);
      }
    } else {
      break;
    }
  }

  const etag = generateETag(buffer);
  const entry: CachedImageEntry = {
    buffer,
    contentType,
    etag,
    size,
    lastAccessed: Date.now(),
  };

  imageCache.set(cacheKey, entry);
  currentCacheBytes += size;
  return entry;
}

/**
 * SingleFlight concurrency map to collapse duplicate concurrent requests for the same image.
 */
const inFlightMap = new Map<string, Promise<{ buffer: Buffer; contentType: string }>>();

export async function deduplicateImageTask<T>(
  cacheKey: string,
  task: () => Promise<T>
): Promise<T> {
  const existing = inFlightMap.get(cacheKey);
  if (existing) {
    return existing as unknown as Promise<T>;
  }

  const promise = task().finally(() => {
    inFlightMap.delete(cacheKey);
  });

  inFlightMap.set(cacheKey, promise as unknown as Promise<{ buffer: Buffer; contentType: string }>);
  return promise;
}

/**
 * Optionally resize/reformat an image buffer via Sharp when query params are present.
 * Supports: ?w=WIDTH&h=HEIGHT&q=QUALITY&fmt=webp|avif
 * Returns { buffer, contentType } with the processed (or original) buffer.
 */
export async function optimizeImageBuffer(
  buffer: Buffer,
  contentType: string,
  query: Record<string, any>
): Promise<{ buffer: Buffer; contentType: string }> {
  const targetWidth = parseInt(query.w as string) || 0;
  const targetHeight = parseInt(query.h as string) || 0;
  const targetQuality = Math.min(100, Math.max(1, parseInt(query.q as string) || 80));
  const targetFormat = (query.fmt as string || '').toLowerCase();
  const isImage = /^image\/(jpeg|png|webp|avif|gif|tiff)/.test(contentType);

  if (!isImage || (!targetWidth && !targetHeight && !targetFormat)) {
    return { buffer, contentType };
  }

  try {
    let pipeline = sharp(buffer);
    if (targetWidth || targetHeight) {
      pipeline = pipeline.resize(targetWidth || undefined, targetHeight || undefined, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    if (targetFormat === 'webp') {
      pipeline = pipeline.webp({ quality: targetQuality });
      contentType = 'image/webp';
    } else if (targetFormat === 'avif') {
      pipeline = pipeline.avif({ quality: targetQuality });
      contentType = 'image/avif';
    } else if (contentType === 'image/jpeg') {
      pipeline = pipeline.jpeg({ quality: targetQuality, mozjpeg: true });
    } else if (contentType === 'image/png') {
      pipeline = pipeline.png({ quality: targetQuality });
    }
    const optimized = await pipeline.toBuffer();
    return { buffer: optimized, contentType };
  } catch {
    // If Sharp fails, return original buffer safely
    return { buffer, contentType };
  }
}
