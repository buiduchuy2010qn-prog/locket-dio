/**
 * Soft watermark when saving images:
 * filled vector heart + brand text at bottom-center.
 * Label syncs from CONFIG.app (Huy Locket branding) — not hard-coded "Locket".
 */

import { useUserSetting } from "@/stores/SettingStores/useUserSetting";

/** Official-style watermark: ♥ Locket (not Huy) */
const WATERMARK_LABEL = "Locket";

/**
 * Draw a clean filled heart (classic card-suit shape) centered at (cx, cy).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} size - heart height roughly
 */
function drawSoftHeart(ctx, cx, cy, size) {
  // Normalized path around (0,0), scaled so height ≈ size
  const s = size / 28;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.beginPath();
  // Classic heart path (smooth lobes + point)
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-2, 2, -12, -2, -12, -10);
  ctx.bezierCurveTo(-12, -16, -7, -20, 0, -14);
  ctx.bezierCurveTo(7, -20, 12, -16, 12, -10);
  ctx.bezierCurveTo(12, -2, 2, 2, 0, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

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

  const label = opts.text || WATERMARK_LABEL;
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
    // Vector heart size (slightly smaller than text for balance)
    const heartH = Math.round(fontSize * 0.92);
    const heartW = Math.round(heartH * 1.05);
    const gap = Math.round(fontSize * 0.28);
    // Higher than before (~7.5% from bottom) so watermark sits a bit higher
    const bottomPad = Math.round(base * 0.078);

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    ctx.font = `500 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
    const textW = ctx.measureText(label).width;
    const totalW = heartW + gap + textW;
    const startX = (w - totalW) / 2;
    // Shared vertical center for heart + text (align baseline middle with heart)
    const y = h - bottomPad;

    // Soft shadow — pale white readable on light areas
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.16));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = Math.max(1, Math.round(fontSize * 0.03));
    // Soft white (~74%)
    ctx.fillStyle = "rgba(255,255,255,0.74)";

    // Heart + text share the same vertical center so they look level
    const heartCx = startX + heartW / 2;
    const heartCy = y;
    drawSoftHeart(ctx, heartCx, heartCy, heartH);

    // Brand label — nudged up slightly so optical middle matches the heart
    // (canvas text with middle baseline often sits a touch low vs vector shapes)
    const textY = y - fontSize * 0.08;
    ctx.font = `500 ${fontSize}px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
    ctx.fillText(label, startX + heartW + gap, textY);

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
