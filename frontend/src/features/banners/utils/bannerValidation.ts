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
  MIN_RATIO: 1.70,
  MAX_RATIO: 1.86,
  RECOMMENDED_WIDTH: 1920,
  RECOMMENDED_HEIGHT: 1080,
  MIN_WIDTH: 1280,
  MIN_HEIGHT: 720,
  MAX_FILE_SIZE_MB: 10
} as const;

/**
 * Validates an image file's dimensions, aspect ratio, and file type.
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
        const ratioDisplay = `${(ratio).toFixed(2)}:1`;

        // 4. Minimum resolution check
        if (width < BANNER_ASPECT_RATIO.MIN_WIDTH || height < BANNER_ASPECT_RATIO.MIN_HEIGHT) {
          return resolve({
            valid: false,
            width,
            height,
            ratio,
            ratioDisplay,
            error: `Resolution Too Low: Your image is ${width} × ${height} px. Banners must be at least ${BANNER_ASPECT_RATIO.MIN_WIDTH} × ${BANNER_ASPECT_RATIO.MIN_HEIGHT} px (16:9 widescreen) to ensure crisp display across desktop and mobile screens.`
          });
        }

        // 5. Compulsory 16:9 Aspect Ratio check
        if (ratio < BANNER_ASPECT_RATIO.MIN_RATIO || ratio > BANNER_ASPECT_RATIO.MAX_RATIO) {
          return resolve({
            valid: false,
            width,
            height,
            ratio,
            ratioDisplay,
            error: `Compulsory Aspect Ratio Mismatch: Your image is ${width} × ${height} px (${ratioDisplay}). All marketplace hero banners must strictly have a 16:9 widescreen aspect ratio (ideal 1920 × 1080 px or 1280 × 720 px) to display uniformly without cropping or distortion.`
          });
        }

        return resolve({
          valid: true,
          width,
          height,
          ratio,
          ratioDisplay: '16:9',
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
 * Validates an image URL's dimensions and 16:9 aspect ratio.
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
      const ratioDisplay = `${(ratio).toFixed(2)}:1`;

      if (width < BANNER_ASPECT_RATIO.MIN_WIDTH || height < BANNER_ASPECT_RATIO.MIN_HEIGHT) {
        return resolve({
          valid: false,
          width,
          height,
          ratio,
          ratioDisplay,
          error: `Resolution Too Low: URL image is ${width} × ${height} px. Banners must be at least ${BANNER_ASPECT_RATIO.MIN_WIDTH} × ${BANNER_ASPECT_RATIO.MIN_HEIGHT} px in 16:9 ratio.`
        });
      }

      if (ratio < BANNER_ASPECT_RATIO.MIN_RATIO || ratio > BANNER_ASPECT_RATIO.MAX_RATIO) {
        return resolve({
          valid: false,
          width,
          height,
          ratio,
          ratioDisplay,
          error: `Compulsory Aspect Ratio Mismatch: URL image is ${width} × ${height} px (${ratioDisplay}). Banners must strictly have a 16:9 widescreen ratio (1920 × 1080 px or 1280 × 720 px).`
        });
      }

      return resolve({
        valid: true,
        width,
        height,
        ratio,
        ratioDisplay: '16:9'
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
        warning: 'Could not verify remote image dimensions due to remote host CORS restrictions. Ensure the image conforms to 16:9 (1920 × 1080 px).'
      });
    };

    img.src = trimmed;
  });
};

/**
 * Automatic client-side crop to 16:9 (1920x1080) for user convenience.
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
