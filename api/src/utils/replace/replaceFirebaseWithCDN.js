// utils/replaceFirebaseWithCDN.js
/**
 * Thay thế host từ firebase storage sang CDN LocketCamera
 * @param {string} url - URL gốc firebase storage
 * @returns {string|null} - URL đã đổi sang CDN hoặc null nếu không có URL
 */
function replaceFirebaseWithCDN(url) {
  if (!url) return null; // hoặc "" nếu bạn muốn
  return url.replace(
    "https://firebasestorage.googleapis.com",
    "https://cdn.locketcamera.com"
  );
}

module.exports = { replaceFirebaseWithCDN };
