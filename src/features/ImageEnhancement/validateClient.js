import { ALLOWED_MIME, MAX_CLIENT_BYTES } from "./constants";

/** Client-side only validation — no network imports (keeps main bundle light). */
export function assertEnhanceableFile(file) {
  if (!file) return { ok: false, message: "Chưa có ảnh để làm nét." };
  if (!String(file.type || "").startsWith("image/")) {
    return {
      ok: false,
      message: "Làm nét chỉ hỗ trợ ảnh (không hỗ trợ video).",
    };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, message: "Chỉ hỗ trợ JPEG, PNG hoặc WebP." };
  }
  if ((file.size || 0) > MAX_CLIENT_BYTES) {
    return {
      ok: false,
      message: "Ảnh quá lớn để gửi AI (tối đa ~12MB).",
    };
  }
  return { ok: true };
}
