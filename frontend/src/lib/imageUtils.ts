export type ImageVariant = 'thumb' | 'card' | 'detail' | 'full';

export function getOptimizedImageUrl(url?: string | null, variant: ImageVariant = 'card', fallback = '/placeholder.png'): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return fallback;
  }

  const cleanUrl = url.trim();

  // Handle Cloudinary dynamic optimization
  if (cleanUrl.includes('res.cloudinary.com')) {
    const widthMap: Record<ImageVariant, number> = {
      thumb: 150,
      card: 400,
      detail: 800,
      full: 1200,
    };
    const width = widthMap[variant] || 400;
    const transform = `f_auto,q_auto,w_${width},c_limit`;

    if (cleanUrl.includes('/upload/')) {
      return cleanUrl.replace('/upload/', `/upload/${transform}/`);
    }
  }

  return cleanUrl;
}
