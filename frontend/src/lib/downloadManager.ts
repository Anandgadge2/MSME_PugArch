/**
 * Central Download Manager for JsgSmile MSME Portal.
 * 
 * Enforces industry-standard safeguards against:
 * 1. Rapid repeated clicks / rage clicks causing duplicate file downloads.
 * 2. Unrevoked blob object URLs leaking browser memory.
 * 3. Concurrent duplicate report/export generation tasks.
 */

const recentDownloads = new Map<string, number>();
const inFlightKeys = new Set<string>();

const DEFAULT_COOLDOWN_MS = 1500;

/**
 * Normalizes a download identifier (filename or endpoint URL) into a stable key.
 */
function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\\/]/g, '_');
}

/**
 * Checks whether a download for the given key is allowed or should be suppressed.
 */
export function canInitiateDownload(key: string, cooldownMs = DEFAULT_COOLDOWN_MS): boolean {
  if (typeof window === 'undefined') return true;

  const normalized = normalizeKey(key);
  const now = Date.now();

  // If already being generated or in-flight
  if (inFlightKeys.has(normalized)) {
    return false;
  }

  // If downloaded very recently within cooldown window
  const lastTime = recentDownloads.get(normalized) || 0;
  if (now - lastTime < cooldownMs) {
    return false;
  }

  // Record timestamp
  recentDownloads.set(normalized, now);

  // Evict old entries to prevent memory accumulation
  if (recentDownloads.size > 200) {
    const threshold = now - 60_000;
    for (const [k, timestamp] of recentDownloads.entries()) {
      if (timestamp < threshold) {
        recentDownloads.delete(k);
      }
    }
  }

  return true;
}

/**
 * Safely triggers a browser file download using standard temporary anchor method.
 * Guarantees duplicate suppression, DOM cleanup, and blob URL memory reclamation.
 * 
 * @returns true if download was triggered, false if suppressed as duplicate.
 */
export function triggerBrowserDownload(
  source: Blob | string,
  filename: string,
  options?: { cooldownMs?: number }
): boolean {
  if (typeof window === 'undefined') return false;

  const safeFilename = filename.trim() || 'document';
  if (!canInitiateDownload(safeFilename, options?.cooldownMs)) {
    return false;
  }

  let blobUrl: string | null = null;
  let targetUrl: string;

  if (source instanceof Blob) {
    blobUrl = URL.createObjectURL(source);
    targetUrl = blobUrl;
  } else {
    targetUrl = source;
  }

  try {
    const link = document.createElement('a');
    link.href = targetUrl;
    link.download = safeFilename;
    link.setAttribute('download', safeFilename);
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      try {
        if (link.parentNode) {
          document.body.removeChild(link);
        }
      } catch {}
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    }, 200);

    return true;
  } catch (err) {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
    throw err;
  }
}

/**
 * Locks an asynchronous download/generation task against concurrent executions.
 * If the user clicks multiple times while generation is in progress, subsequent
 * clicks are cleanly ignored.
 */
export async function withDownloadLock<T>(
  key: string,
  task: () => Promise<T>,
  cooldownMs = DEFAULT_COOLDOWN_MS
): Promise<T | null> {
  const normalized = normalizeKey(key);
  if (!canInitiateDownload(normalized, cooldownMs)) {
    return null;
  }

  inFlightKeys.add(normalized);
  try {
    const result = await task();
    return result;
  } finally {
    setTimeout(() => {
      inFlightKeys.delete(normalized);
    }, 500);
  }
}
