/**
 * Locket-style watermark when saving images:
 * soft filled white heart + "Locket" at bottom-center (match official Locket export).
 */

import { useUserSetting } from "@/stores/SettingStores/useUserSetting";

/** Official-style save watermark label (exact "Locket", not Huy Locket) */
const DEFAULT_LABEL = "Locket";

/**
 * User preference from SettingPoup (persisted).
 * Default true when store not ready.
 * @returns {boolean}
 */
export function isSaveWatermarkEnabled() {
  try {
    return useUserSetting.getState?.()?.saveWatermark !== false;
  } catch {
    try {
      const raw = localStorage.getItem("user-settings");
      if (!raw) return true;
      const parsed = JSON.parse(raw);
      const state = parsed?.state ?? parsed;
      return state?.saveWatermark !== false;
    } catch {
      return true;
    }
  }
}

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
 * Draw filled ♥ + text bottom-center, return JPEG blob.
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

    // Scale watermark with image size (match official Locket soft white look)
    const base = Math.min(w, h);
    const fontSize = Math.max(18, Math.round(base * 0.04));
    // Filled soft heart (♥ solid, not outline ♡)
    const heartSize = Math.round(fontSize * 1.12);
    const gap = Math.round(fontSize * 0.32);
    const bottomPad = Math.round(base * 0.055);

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // Filled heart (not hollow outline)
    const heart = "♥";
    ctx.font = `600 ${heartSize}px system-ui, -apple-system, "Segoe UI", Roboto, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    const heartW = ctx.measureText(heart).width;
    ctx.font = `500 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const textW = ctx.measureText(label).width;
    const totalW = heartW + gap + textW;
    const startX = (w - totalW) / 2;
    const y = h - bottomPad;

    // Soft shadow so pale white stays readable on light areas
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.18));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.03));
    // Trắng nhạt / soft white (~70%)
    ctx.fillStyle = "rgba(255,255,255,0.72)";

    // Heart — solid fill, pale white
    ctx.font = `600 ${heartSize}px system-ui, -apple-system, "Segoe UI", Roboto, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.fillText(heart, startX, y);

    // Label — exact "Locket", medium weight, same pale white
    ctx.font = `500 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(label, startX + heartW + gap, y);

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
