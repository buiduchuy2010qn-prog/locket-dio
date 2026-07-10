import { createImage } from "./createImage";

export const getCroppedImg = async (file, crop, rotation = 0) => {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await createImage(imageUrl);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) throw new Error("Canvas context not available");

    const croppedWidth = crop.width;
    const croppedHeight = crop.height;

    canvas.width = croppedWidth;
    canvas.height = croppedHeight;

    ctx.save();
    ctx.translate(croppedWidth / 2, croppedHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    ctx.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      -croppedWidth / 2,
      -croppedHeight / 2,
      croppedWidth,
      croppedHeight
    );

    ctx.restore();

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);

        const file = new File([blob], "cropped-image.jpg", {
          type: blob.type,
        });

        resolve(file);
      }, "image/jpeg");
    });
  } finally {
    URL.revokeObjectURL(imageUrl); // ✅ QUAN TRỌNG (fix Android leak + blank image)
  }
};