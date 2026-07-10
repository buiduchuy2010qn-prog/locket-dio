/**
 * Tạo lỗi HTTP có chuẩn hóa thông tin
 * @param {number} status - HTTP status code (ví dụ: 401, 403, 500)
 * @param {string} code - Mã lỗi tùy chỉnh để dễ debug (ví dụ: "TOKEN_EXPIRED")
 * @param {string} message - Thông báo lỗi
 * @returns {Error} đối tượng lỗi chuẩn
 */
function createHttpError(
  status = 500,
  code = "INTERNAL_ERROR",
  message = "Đã xảy ra lỗi"
) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

module.exports = { createHttpError };
