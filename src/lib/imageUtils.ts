import { removeBackground } from '@imgly/background-removal';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Resize to max 800px to save space
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8)); // Use JPEG with 80% quality
        } else {
          resolve(reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};

export const processClothingImage = async (file: File): Promise<string> => {
  try {
    // 1. Remove background using @imgly/background-removal
    const blob = await removeBackground(file, {
      output: { format: 'image/png' },
      debug: false
    });

    return new Promise((resolve, reject) => {
      const imgUrl = URL.createObjectURL(blob);
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(imgUrl);
          return reject(new Error('Canvas not supported'));
        }

        ctx.drawImage(img, 0, 0);

        // 2. Find bounding box of the foreground object
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
        let found = false;

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            // Index of the alpha channel
            const alpha = data[(y * canvas.width + x) * 4 + 3];
            if (alpha > 10) { // Threshold for foreground
              found = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (!found) {
           // If somehow the background removal resulted in an empty image, fallback
           minX = 0; minY = 0; maxX = canvas.width; maxY = canvas.height;
        }

        const subjectWidth = maxX - minX;
        const subjectHeight = maxY - minY;

        // 3. Create a 1:1 canvas on a white background with padding
        const maxDim = Math.max(subjectWidth, subjectHeight);
        const padding = Math.max(20, Math.floor(maxDim * 0.1)); // At least 20px padding or 10%
        const totalSize = maxDim + padding * 2;

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = totalSize;
        finalCanvas.height = totalSize;
        const finalCtx = finalCanvas.getContext('2d');
        
        if (!finalCtx) {
          URL.revokeObjectURL(imgUrl);
          return reject(new Error('Canvas not supported'));
        }

        // Fill white background
        finalCtx.fillStyle = '#ffffff';
        finalCtx.fillRect(0, 0, totalSize, totalSize);

        // Draw subject centered
        const dx = (totalSize - subjectWidth) / 2;
        const dy = (totalSize - subjectHeight) / 2;

        finalCtx.drawImage(
          img,
          minX, minY, subjectWidth, subjectHeight,
          dx, dy, subjectWidth, subjectHeight
        );

        URL.revokeObjectURL(imgUrl);
        // We use JPEG here since background is white and typically JPEG is smaller
        resolve(finalCanvas.toDataURL('image/jpeg', 0.9));
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(imgUrl);
        reject(new Error('Failed to parse final image'));
      };
      
      img.src = imgUrl;
    });
  } catch (err) {
    console.error('Failed to process image:', err);
    // Fallback to original image processing if anything fails
    return fileToBase64(file);
  }
};
