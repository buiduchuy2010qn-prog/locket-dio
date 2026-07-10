/**
 * Label hiển thị cho nút caption trong Customize Studio.
 * Suggest Caption (type=custom) có text=null → dùng tên theme từ overlay_id.
 */

/** Map tên đẹp cho theme gợi ý (fallback khi API text=null) */
const OVERLAY_PRETTY_NAMES = {
  galaxy: "Galaxy",
  peachy: "Peachy",
  sunset: "Sunset",
  aqua_fresh: "Aqua Fresh",
  cotton_candy: "Cotton Candy",
  bubblegum: "Bubblegum",
  ocean: "Ocean",
};

/**
 * "galaxy" → "Galaxy", "aqua_fresh" → "Aqua Fresh", "wc_2026_tur_par" → "Wc 2026 Tur Par"
 */
export function prettyOverlayId(overlayId) {
  if (!overlayId) return "";
  const key = String(overlayId).toLowerCase();
  if (OVERLAY_PRETTY_NAMES[key]) return OVERLAY_PRETTY_NAMES[key];

  return String(overlayId)
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Chuẩn hóa text thô từ API.
 * - null/"" → null
 * - "TUR       PAR" → "TUR · PAR" (gọn, vẫn đọc được)
 */
export function normalizeOverlayText(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "null" || s === "undefined") return null;
  // Nhiều khoảng trắng (WC flags) → dấu chấm giữa
  return s.replace(/\s{2,}/g, " · ").trim();
}

export function getOverlayDisplayText(item) {
  if (!item) return "Caption";

  // Ưu tiên field đã normalize sẵn
  if (item.display_text && String(item.display_text).trim()) {
    return String(item.display_text).trim();
  }

  const raw = normalizeOverlayText(
    item.text ??
      item.caption ??
      item.title ??
      item.name ??
      item.label ??
      null,
  );

  if (raw) return raw;

  const id = item.overlay_id || item.id || item.preset_id;
  if (id) return prettyOverlayId(id);

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

/**
 * Gắn display_text + làm sạch icon rỗng cho từng item (dùng khi fetch/cache).
 */
export function enrichOverlayItem(item) {
  if (!item || typeof item !== "object") return item;

  const display_text = getOverlayDisplayText(item);
  const icon = hasValidIcon(item.icon) ? item.icon : null;

  return {
    ...item,
    display_text,
    icon,
  };
}
