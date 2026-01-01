
/**
 * فشرده‌سازی عکس با حفظ کیفیت نسبی تا رسیدن به حجم مطلوب
 */
export const compressImage = async (file: File, maxKB: number = 150): Promise<Blob> => {
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

        const MAX_WIDTH = 1200;
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
