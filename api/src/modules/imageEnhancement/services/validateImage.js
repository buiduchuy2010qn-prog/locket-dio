const sharp = require("sharp");

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = Number(process.env.IMAGE_ENHANCE_MAX_BYTES || 12 * 1024 * 1024);
const MAX_PIXELS = Number(process.env.IMAGE_ENHANCE_MAX_PIXELS || 12_000_000);

/**
 * Validate buffer magic + size + pixels. Never trust client MIME alone.
 */
async function validateImageBuffer(buffer, claimedMime) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return { ok: false, code: "INVALID_FILE", message: "File ảnh không hợp lệ." };
  }
  if (buffer.length > MAX_BYTES) {
    return {
      ok: false,
      code: "TOO_LARGE",
      message: `Ảnh quá lớn (tối đa ${Math.round(MAX_BYTES / (1024 * 1024))}MB).`,
    };
  }

  let meta;
  try {
    meta = await sharp(buffer, { failOn: "none" }).metadata();
  } catch {
    return { ok: false, code: "INVALID_IMAGE", message: "Không đọc được ảnh." };
  }

  const format = String(meta.format || "").toLowerCase();
  const mimeFromFormat =
    format === "jpeg" || format === "jpg"
      ? "image/jpeg"
      : format === "png"
        ? "image/png"
        : format === "webp"
          ? "image/webp"
          : null;

  if (!mimeFromFormat || !ALLOWED.has(mimeFromFormat)) {
    return {
      ok: false,
      code: "UNSUPPORTED_TYPE",
      message: "Chỉ hỗ trợ JPEG, PNG hoặc WebP.",
    };
  }

  // Optional: reject if client claimed wildly different (still accept real format)
  if (claimedMime && !String(claimedMime).startsWith("image/")) {
    return { ok: false, code: "BAD_MIME", message: "MIME không hợp lệ." };
  }

  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w * h > MAX_PIXELS) {
    return {
      ok: false,
      code: "TOO_MANY_PIXELS",
      message: "Ảnh quá nhiều pixel để xử lý an toàn.",
    };
  }

  return {
    ok: true,
    mime: mimeFromFormat,
    width: w,
    height: h,
    orientation: meta.orientation || 1,
  };
}

module.exports = { validateImageBuffer, MAX_BYTES, MAX_PIXELS, ALLOWED };
