export interface ImageVariants {
  thumbnail: Blob;
  medium: Blob;
  large: Blob;
  original: Blob;
}

export interface ImageSizeConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

// Predefined image size configurations
export const IMAGE_SIZES = {
  thumbnail: { maxWidth: 150, maxHeight: 150, quality: 0.85 },
  medium: { maxWidth: 600, maxHeight: 600, quality: 0.9 },
  large: { maxWidth: 1200, maxHeight: 1200, quality: 0.92 },
  original: { maxWidth: 2000, maxHeight: 2000, quality: 0.95 },
} as const;

/**
 * Resizes an image file to specified dimensions while maintaining aspect ratio
 * @param file - The original image file
 * @param maxWidth - Maximum width in pixels
 * @param maxHeight - Maximum height in pixels
 * @param quality - Image quality (0-1)
 * @returns Promise resolving to a Blob of the resized image
 */
export const resizeImage = async (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error('Failed to read file'));
        return;
      }

      img.onload = () => {
        // Calculate new dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;

          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }

          // Ensure both dimensions are within limits
          if (width > maxWidth) {
            width = maxWidth;
            height = width / aspectRatio;
          }
          if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Use better image smoothing for quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Generates all image variants (thumbnail, medium, large, original) from a single file
 * @param file - The original image file
 * @returns Promise resolving to an object containing all image variants
 */
export const generateImageVariants = async (file: File): Promise<ImageVariants> => {
  try {
    const [thumbnail, medium, large, original] = await Promise.all([
      resizeImage(
        file,
        IMAGE_SIZES.thumbnail.maxWidth,
        IMAGE_SIZES.thumbnail.maxHeight,
        IMAGE_SIZES.thumbnail.quality
      ),
      resizeImage(
        file,
        IMAGE_SIZES.medium.maxWidth,
        IMAGE_SIZES.medium.maxHeight,
        IMAGE_SIZES.medium.quality
      ),
      resizeImage(
        file,
        IMAGE_SIZES.large.maxWidth,
        IMAGE_SIZES.large.maxHeight,
        IMAGE_SIZES.large.quality
      ),
      resizeImage(
        file,
        IMAGE_SIZES.original.maxWidth,
        IMAGE_SIZES.original.maxHeight,
        IMAGE_SIZES.original.quality
      ),
    ]);

    return {
      thumbnail,
      medium,
      large,
      original,
    };
  } catch (error) {
    console.error('Error generating image variants:', error);
    throw error;
  }
};

/**
 * Gets the appropriate file extension based on MIME type
 * @param mimeType - The MIME type of the image
 * @returns File extension without the dot
 */
export const getFileExtension = (mimeType: string): string => {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  return extensions[mimeType] || 'jpg';
};
