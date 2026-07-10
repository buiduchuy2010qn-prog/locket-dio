const logEvents = require("./log-events");
const { v4: uuid } = require("uuid");

module.exports = (err, req, res, next) => {
  const errorId = uuid();

  // Ghi log lỗi vào file hoặc console
  console.log(
    `❌ ERROR | ID: ${errorId} | URL: ${req.url} | METHOD: ${
      req.method
    } | STATUS: ${err.status || 500} | MESSAGE: ${err.message}`
  );

  // console.error(`🔥 Lỗi ID: ${errorId} |`, err);

  // Kiểm tra nếu headers đã được gửi thì chuyển lỗi tiếp theo middleware
  if (res.headersSent) {
    return next(err);
  }

  // Xác định mã trạng thái (nếu không có thì dùng 500)
  const statusCode = err.status || 500;

  // Xây dựng response lỗi theo JSON Standard Error
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    error: {
      errorId, // Mã lỗi duy nhất giúp debug
      status: statusCode, // HTTP Status Code
      code: err.code || "INTERNAL_SERVER_ERROR", // Mã lỗi tùy chỉnh
      message: err.message || "Đã xảy ra lỗi, vui lòng thử lại sau.",
      path: req.originalUrl, // Đường dẫn gây ra lỗi
      method: req.method, // Phương thức HTTP
      timestamp: new Date().toISOString(), // Thời gian xảy ra lỗi
    },
  });
};
