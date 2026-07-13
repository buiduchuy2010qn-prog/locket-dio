import { createImage } from "./createImage";

/**
 * Cắt vùng pixels từ file → JPEG.
 * Clamp crop vào biên ảnh để tránh canvas trống trên mobile.
 */
export const getCroppedImg = async (file, crop, rotation = 0) => {
  if (!file || !crop) throw new Error("Thiếu file hoặc vùng cắt");

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await createImage(imageUrl);
    const imgW = image.naturalWidth || image.width;
    const imgH = image.naturalHeight || image.height;
    if (!imgW || !imgH) throw new Error("Ảnh không có kích thước");

    // Clamp vào biên ảnh
    let sx = Math.max(0, Math.round(Number(crop.x) || 0));
    let sy = Math.max(0, Math.round(Number(crop.y) || 0));
    let sw = Math.max(1, Math.round(Number(crop.width) || 0));
    let sh = Math.max(1, Math.round(Number(crop.height) || 0));
    if (sx + sw > imgW) sw = Math.max(1, imgW - sx);
    if (sy + sh > imgH) sh = Math.max(1, imgH - sy);

    // Output tối đa 1080 (Locket-friendly)
    const maxOut = 1080;
    let outW = sw;
    let outH = sh;
    if (outW > maxOut || outH > maxOut) {
      const r = Math.min(maxOut / outW, maxOut / outH);
      outW = Math.max(1, Math.round(outW * r));
      outH = Math.max(1, Math.round(outH * r));
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas context not available");

    canvas.width = outW;
    canvas.height = outH;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, outW, outH);

    if (rotation) {
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(image, sx, sy, sw, sh, -outW / 2, -outH / 2, outW, outH);
      ctx.restore();
    } else {
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, outW, outH);
    }

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.92,
      );
    });

    return new File([blob], "cropped-image.jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};