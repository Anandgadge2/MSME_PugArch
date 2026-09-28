import sharp from 'sharp';

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
