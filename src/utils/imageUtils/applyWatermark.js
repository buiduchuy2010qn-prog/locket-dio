/**
 * Locket-style watermark when saving images:
 * white heart + label at bottom-center (like official Locket export).
 * Brand label: Huy Locket (never Locket Dio).
 */

import { CONFIG } from "@/config";

const DEFAULT_LABEL =
  (CONFIG?.app?.name && String(CONFIG.app.name).trim()) || "Huy Locket";

/**
 * @param {Blob|File} blob
 * @returns {boolean}
 */
export function isImageBlob(blob) {
  if (!blob) return false;
  const t = String(blob.type || "").toLowerCase();
  if (t.startsWith("image/")) return true;
  // some proxies return empty type
  if (!t && blob.size > 0) return false;
  return false;
}

/**
 * @param {string} fileName
 * @returns {boolean}
 */
export function isImageFileName(fileName = "") {
  return /\.(jpe?g|png|webp|gif|heic|bmp)$/i.test(String(fileName));
}

/**
 * Draw ♡ + text bottom-center, return JPEG blob.
 * On failure returns original blob (never break download).
 *
 * @param {Blob|File} blob
 * @param {{ text?: string, quality?: number }} [opts]
 * @returns {Promise<Blob>}
 */
export async function applyLocketStyleWatermark(blob, opts = {}) {
  if (!blob || typeof document === "undefined") return blob;
  if (!isImageBlob(blob) && !isImageFileName(opts.fileName || "")) {
    // last chance: try decode anyway if type missing but we know it's image
    if (!opts.forceImage) return blob;
  }

  const label = opts.text || DEFAULT_LABEL;
  const quality =
    typeof opts.quality === "number" && opts.quality > 0 && opts.quality <= 1
      ? opts.quality
      : 0.92;

  try {
    const bitmap = await blobToImage(blob);
    const w = bitmap.naturalWidth || bitmap.width;
    const h = bitmap.naturalHeight || bitmap.height;
    if (!w || !h) return blob;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;

    ctx.drawImage(bitmap, 0, 0, w, h);
    if (typeof bitmap.close === "function") {
      try {
        bitmap.close();
      } catch {
        /* ignore */
      }
    }

    // Scale watermark with image size (match Locket look on ~1080–1800px)
    const base = Math.min(w, h);
    const fontSize = Math.max(18, Math.round(base * 0.038));
    const heartSize = Math.round(fontSize * 1.15);
    const gap = Math.round(fontSize * 0.35);
    const bottomPad = Math.round(base * 0.055);

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

    const heart = "♡";
    const heartW = ctx.measureText(heart).width;
    // Use slightly larger font for heart for visual balance
    ctx.font = `400 ${heartSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const heartW2 = ctx.measureText(heart).width;
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const textW = ctx.measureText(label).width;
    const totalW = heartW2 + gap + textW;
    const startX = (w - totalW) / 2;
    const y = h - bottomPad;

    // Soft dark shadow so white watermark reads on light areas
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = Math.max(4, Math.round(fontSize * 0.35));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.06));
    ctx.fillStyle = "rgba(255,255,255,0.95)";

    // Heart
    ctx.font = `400 ${heartSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(heart, startX, y);

    // Label
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(label, startX + heartW2 + gap, y);

    ctx.restore();

    const out = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        quality,
      );
    });
    return out || blob;
  } catch (e) {
    console.warn("[watermark] apply failed, using original:", e?.message);
    return blob;
  }
}

/**
 * @param {Blob} blob
 * @returns {Promise<HTMLImageElement|ImageBitmap>}
 */
async function blobToImage(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image load failed"));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Ensure filename matches JPEG after watermark.
 * @param {string} fileName
 */
export function ensureJpegFileName(fileName = "moment.jpg") {
  const base = String(fileName || "moment").replace(/\.[^.]+$/, "");
  return `${base || "moment"}.jpg`;
}
