/** Load HTMLImageElement từ URL (blob/data/https) */
export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    // blob: không set crossOrigin — tránh taint + fail load
    if (url && !String(url).startsWith("blob:")) {
      try {
        image.crossOrigin = "anonymous";
      } catch {
        /* ignore */
      }
    }
    image.onload = () => {
      if ((image.naturalWidth || 0) < 1) {
        reject(new Error("Image has zero size"));
        return;
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = url;
  });
