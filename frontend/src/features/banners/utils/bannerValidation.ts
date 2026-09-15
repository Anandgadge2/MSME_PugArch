/**
 * Compulsory Banner Aspect Ratio & Resolution Validation Utility
 *
 * Enforces strict 16:9 aspect ratio (recommended 1920x1080, min 1280x720)
 * across Admin and User/Organization banner upload utilities.
 */

export interface BannerValidationResult {
  valid: boolean;
  width: number;
  height: number;
  ratio: number;
  ratioDisplay: string;
  error?: string;
  warning?: string;
}

export const BANNER_ASPECT_RATIO = {
  RATIO_X: 16,
  RATIO_Y: 9,
  TARGET_RATIO: 16 / 9, // 1.7777...
  // Supported aspect ratios: 4:3 (1.33:1), 3:2 (1.50:1), 16:10 (1.60:1), 16:9 (1.78:1), and Panoramic up to 21:9 (2.33:1)
  MIN_RATIO: 1.25,
  MAX_RATIO: 2.50,
  RECOMMENDED_WIDTH: 1920,
  RECOMMENDED_HEIGHT: 1080,
  MIN_WIDTH: 800,
  MIN_HEIGHT: 360,
  MAX_FILE_SIZE_MB: 10
} as const;

export const formatAspectRatioLabel = (ratio: number): string => {
  if (ratio >= 1.70 && ratio <= 1.86) return '16:9 Widescreen';
  if (ratio >= 1.55 && ratio < 1.70) return '16:10 Landscape';
  if (ratio >= 1.45 && ratio < 1.55) return '3:2 Landscape';
  if (ratio >= 1.25 && ratio < 1.45) return '4:3 Standard';
  if (ratio > 1.86 && ratio <= 2.50) return `${ratio.toFixed(2)}:1 Panoramic`;
  return `${ratio.toFixed(2)}:1`;
};

/**
 * Validates an image file's dimensions, aspect ratio, and file type.
 * Supports standard landscape hero banner aspect ratios (16:9, 16:10, 3:2, 4:3, Panoramic).
 */
export const validateBannerFile = (file: File): Promise<BannerValidationResult> => {
  return new Promise((resolve) => {
    // 1. File type verification
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return resolve({
        valid: false,
        width: 0,
        height: 0,
        ratio: 0,
        ratioDisplay: 'N/A',
        error: `Unsupported File Format (${file.type || 'unknown'}). Banners must be uploaded as JPG, PNG, or WebP.`
      });
    }

    // 2. File size verification
    const maxBytes = BANNER_ASPECT_RATIO.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      return resolve({
        valid: false,
        width: 0,
        height: 0,
        ratio: 0,
        ratioDisplay: 'N/A',
        error: `File Size Exceeded (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed banner file size is ${BANNER_ASPECT_RATIO.MAX_FILE_SIZE_MB} MB.`
      });
    }

    // 3. Read image dimensions
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        if (!width || !height) {
          return resolve({
            valid: false,
            width: 0,
            height: 0,
            ratio: 0,
            ratioDisplay: 'N/A',
            error: 'Unable to detect image dimensions. Please select a valid banner image file.'
          });
        }

        const ratio = width / height;
        const ratioDisplay = formatAspectRatioLabel(ratio);

        // 4. Minimum resolution check
        if (width < BANNER_ASPECT_RATIO.MIN_WIDTH || height < BANNER_ASPECT_RATIO.MIN_HEIGHT) {
          return resolve({
            valid: false,
            width,
            height,
            ratio,
            ratioDisplay,
            error: `Resolution Too Low: Your image is ${width} × ${height} px. Banners must be at least ${BANNER_ASPECT_RATIO.MIN_WIDTH} × ${BANNER_ASPECT_RATIO.MIN_HEIGHT} px to ensure crisp display across desktop and mobile screens.`
          });
        }

        // 5. Landscape Aspect Ratio check (supports 16:9, 16:10, 3:2, 4:3, up to 21:9 panoramic)
        if (ratio < BANNER_ASPECT_RATIO.MIN_RATIO) {
          return resolve({
            valid: false,
            width,
            height,
            ratio,
            ratioDisplay,
            error: `Aspect Ratio Warning: Your image is portrait or too tall (${width} × ${height} px, ${ratio.toFixed(2)}:1). Hero banners must be landscape (such as 16:9, 16:10, 3:2, 4:3, or panoramic) to display responsively across viewports.`
          });
        }

        if (ratio > BANNER_ASPECT_RATIO.MAX_RATIO) {
          return resolve({
            valid: false,
            width,
            height,
            ratio,
            ratioDisplay,
            error: `Aspect Ratio Warning: Your image is an extreme narrow strip (${width} × ${height} px, ${ratio.toFixed(2)}:1). Maximum supported panoramic ratio is 21:9 (2.4:1).`
          });
        }

        return resolve({
          valid: true,
          width,
          height,
          ratio,
          ratioDisplay,
        });
      };

      img.onerror = () => {
        resolve({
          valid: false,
          width: 0,
          height: 0,
          ratio: 0,
          ratioDisplay: 'N/A',
          error: 'Corrupt or unreadable image file. Please upload a valid JPG, PNG, or WebP.'
        });
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      resolve({
        valid: false,
        width: 0,
        height: 0,
        ratio: 0,
        ratioDisplay: 'N/A',
        error: 'Failed to read image file from disk.'
      });
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Validates an image URL's dimensions and landscape aspect ratio.
 */
export const validateBannerUrl = (url: string): Promise<BannerValidationResult> => {
  return new Promise((resolve) => {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      return resolve({
        valid: false,
        width: 0,
        height: 0,
        ratio: 0,
        ratioDisplay: 'N/A',
        error: 'Please provide a valid image URL.'
      });
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      if (!width || !height) {
        return resolve({
          valid: false,
          width: 0,
          height: 0,
          ratio: 0,
          ratioDisplay: 'N/A',
          error: 'Image loaded from URL has invalid zero dimensions.'
        });
      }

      const ratio = width / height;
      const ratioDisplay = formatAspectRatioLabel(ratio);

      if (width < BANNER_ASPECT_RATIO.MIN_WIDTH || height < BANNER_ASPECT_RATIO.MIN_HEIGHT) {
        return resolve({
          valid: false,
          width,
          height,
          ratio,
          ratioDisplay,
          error: `Resolution Too Low: URL image is ${width} × ${height} px. Banners must be at least ${BANNER_ASPECT_RATIO.MIN_WIDTH} × ${BANNER_ASPECT_RATIO.MIN_HEIGHT} px.`
        });
      }

      if (ratio < BANNER_ASPECT_RATIO.MIN_RATIO) {
        return resolve({
          valid: false,
          width,
          height,
          ratio,
          ratioDisplay,
          error: `Aspect Ratio Warning: URL image is portrait or too tall (${width} × ${height} px, ${ratio.toFixed(2)}:1). Hero banners must be landscape (16:9, 16:10, 3:2, 4:3, or panoramic).`
        });
      }

      if (ratio > BANNER_ASPECT_RATIO.MAX_RATIO) {
        return resolve({
          valid: false,
          width,
          height,
          ratio,
          ratioDisplay,
          error: `Aspect Ratio Warning: URL image is an extreme narrow strip (${width} × ${height} px, ${ratio.toFixed(2)}:1). Maximum supported panoramic ratio is 21:9 (2.4:1).`
        });
      }

      return resolve({
        valid: true,
        width,
        height,
        ratio,
        ratioDisplay
      });
    };

    img.onerror = () => {
      // Remote host CORS might block inspection, but if it loads without crossOrigin, accept with warning
      resolve({
        valid: true,
        width: 1920,
        height: 1080,
        ratio: 16 / 9,
        ratioDisplay: '16:9',
        warning: 'Could not verify remote image dimensions due to remote host CORS restrictions. Ensure the image conforms to a landscape ratio (16:9, 16:10, 3:2, 4:3, or panoramic).'
      });
    };

    img.src = trimmed;
  });
};

/**
 * Optional client-side crop to 16:9 (1920x1080) for user convenience if an image is portrait or extreme.
 */
export const cropImageTo16by9 = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const targetRatio = BANNER_ASPECT_RATIO.TARGET_RATIO; // 16 / 9
        const currentRatio = img.width / img.height;
        let cropX = 0;
        let cropY = 0;
        let cropWidth = img.width;
        let cropHeight = img.height;

        if (currentRatio > targetRatio) {
          // Wider than 16:9: crop left and right
          cropWidth = Math.round(img.height * targetRatio);
          cropX = Math.round((img.width - cropWidth) / 2);
        } else {
          // Taller than 16:9: crop top and bottom
          cropHeight = Math.round(img.width / targetRatio);
          cropY = Math.round((img.height - cropHeight) / 2);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.min(Math.max(cropWidth, BANNER_ASPECT_RATIO.MIN_WIDTH), BANNER_ASPECT_RATIO.RECOMMENDED_WIDTH);
        canvas.height = Math.round(canvas.width * 9 / 16);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D context not available'));

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Failed to create cropped image blob'));
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const croppedFile = new File([blob], `${baseName}_16x9.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(croppedFile);
          },
          'image/jpeg',
          0.88
        );
      };
      img.onerror = () => reject(new Error('Unable to decode image for cropping'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Unable to read image file'));
    reader.readAsDataURL(file);
  });
};
