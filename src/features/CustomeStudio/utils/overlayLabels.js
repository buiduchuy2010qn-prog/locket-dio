/**
 * Label hiển thị cho nút caption trong Customize Studio.
 * Suggest Caption (type=custom) có text=null → dùng tên theme từ overlay_id.
 */
export function getOverlayDisplayText(item) {
  if (!item) return "Caption";

  const raw =
    item.text ??
    item.caption ??
    item.title ??
    item.name ??
    item.label ??
    null;

  if (raw != null && String(raw).trim() !== "") {
    // "TUR       PAR" → "TUR · PAR" gọn hơn
    return String(raw).replace(/\s{2,}/g, " · ").trim();
  }

  if (item.overlay_id) {
    return String(item.overlay_id)
      .split(/[_-]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return "Caption";
}

/** Icon có data thật (bỏ object rỗng {}) */
export function hasValidIcon(icon) {
  if (!icon || typeof icon !== "object") return false;
  if (!icon.type) return false;
  if (icon.type === "emoji" && icon.data) return true;
  if (icon.type === "image" && icon.data) return true;
  if (icon.type === "sf_symbol" && icon.data) return true;
  return false;
}
