/**
 * Tên file + MIME an toàn cho tải về máy / backup Drive.
 * Tránh lỗi type "video/webm;codecs=vp9" → đuôi file hỏng → hiện icon tài liệu.
 */

export function cleanMimeType(raw) {
  const t = String(raw || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!t) return "";
  if (t === "image/jpg") return "image/jpeg";
  return t;
}

/** Extension chuẩn từ MIME / tên file */
export function extensionFromMedia(file, mediaHint = "") {
  const mime = cleanMimeType(file?.type);
  const name = String(file?.name || "").toLowerCase();
  const hint = String(mediaHint || "").toLowerCase();

  if (mime === "video/webm" || name.endsWith(".webm")) return "webm";
  if (mime === "video/mp4" || name.endsWith(".mp4")) return "mp4";
  if (mime === "video/quicktime" || name.endsWith(".mov")) return "mov";
  if (mime.startsWith("video/")) {
    const sub = mime.split("/")[1];
    if (sub && /^[a-z0-9]+$/.test(sub)) return sub === "mpeg" ? "mpg" : sub;
    return "mp4";
  }
  if (mime === "image/png" || name.endsWith(".png")) return "png";
  if (mime === "image/webp" || name.endsWith(".webp")) return "webp";
  if (mime === "image/gif" || name.endsWith(".gif")) return "gif";
  if (mime.startsWith("image/")) return "jpg";

  if (hint === "video" || /\.(mp4|webm|mov|m4v|3gp)$/i.test(name)) {
    if (name.endsWith(".webm")) return "webm";
    return "mp4";
  }
  return "jpg";
}

export function contentTypeFromMedia(file, mediaHint = "") {
  const mime = cleanMimeType(file?.type);
  if (mime.startsWith("video/") || mime.startsWith("image/")) return mime;

  const ext = extensionFromMedia(file, mediaHint);
  const map = {
    webm: "video/webm",
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/mp4",
    "3gp": "video/3gpp",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] || (mediaHint === "video" ? "video/mp4" : "image/jpeg");
}

export function buildDownloadFileName(file, mediaHint = "") {
  const ext = extensionFromMedia(file, mediaHint);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `huylocket_${ts}.${ext}`;
}

/** File mới với type + tên sạch (giữ blob) */
export function normalizeMediaFile(file, mediaHint = "") {
  if (!file) return file;
  const type = contentTypeFromMedia(file, mediaHint);
  const ext = extensionFromMedia(file, mediaHint);
  const base =
    (file.name && file.name.replace(/\.[^.]+$/, "")) || `huy_locket_${Date.now()}`;
  const safeBase = String(base).replace(/[^\w.\-()+]+/g, "_").slice(0, 80);
  return new File([file], `${safeBase}.${ext}`, {
    type,
    lastModified: file.lastModified || Date.now(),
  });
}
