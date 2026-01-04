
/**
 * فشرده‌سازی عکس با حفظ کیفیت نسبی
 */
export const compressImage = async (file: File | Blob, maxKB: number = 150): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = 1080;
        if (width > MAX_WIDTH) {
          height = (MAX_WIDTH / width) * height;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const attemptCompression = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                if (blob.size / 1024 < maxKB || q < 0.2) {
                  resolve(blob);
                } else {
                  attemptCompression(q - 0.1);
                }
              }
            },
            'image/jpeg',
            q
          );
        };
        attemptCompression(0.8);
      };
    };
    reader.onerror = (e) => reject(e);
  });
};

/**
 * برش تصویر بر اساس قاب مشاهده شده توسط کاربر
 */
export const getCroppedImg = (
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  targetSize: number = 1080
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not found'));
        return;
      }

      // رسم ناحیه انتخاب شده در بوم خروجی
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        targetSize,
        targetSize
      );

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas is empty'));
      }, 'image/jpeg', 0.9);
    };
    image.onerror = (e) => reject(e);
  });
};
