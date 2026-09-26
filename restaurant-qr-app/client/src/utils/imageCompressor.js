/**
 * Client-Side Image Compression Utility
 * Resizes large camera photos (5-10MB) down to ~100-200KB before uploading to the server.
 * Uses HTML5 Canvas with bilinear scaling and JPEG/WebP compression.
 */

export const compressImage = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      // If not an image, return original file
      return resolve(file);
    }

    const maxWidth = options.maxWidth || 1280;
    const maxHeight = options.maxHeight || 1280;
    const quality = options.quality !== undefined ? options.quality : 0.75;
    const outputType = options.outputType || 'image/jpeg';

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio preserving scaling
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file); // fallback
        }

        // Draw image onto canvas
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to Blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }

            // Preserve original filename
            const fileName = (file.name || 'compressed_image.jpg').replace(/\.[^/.]+$/, "") + '.jpg';
            const compressedFile = new File([blob], fileName, {
              type: outputType,
              lastModified: Date.now()
            });

            console.log(`[COMPRESSOR] ${file.name}: ${(file.size / 1024).toFixed(1)} KB ➔ ${(compressedFile.size / 1024).toFixed(1)} KB (Saved ${(((file.size - compressedFile.size) / file.size) * 100).toFixed(0)}%)`);
            resolve(compressedFile);
          },
          outputType,
          quality
        );
      };

      img.onerror = () => {
        // Fallback to original file on load error
        resolve(file);
      };
    };

    reader.onerror = () => {
      resolve(file);
    };
  });
};

/**
 * Batch compress multiple image files simultaneously
 */
export const compressMultipleImages = async (fileList, options = {}) => {
  if (!fileList || fileList.length === 0) return [];
  const files = Array.from(fileList);
  const compressed = await Promise.all(files.map(f => compressImage(f, options)));
  return compressed;
};
