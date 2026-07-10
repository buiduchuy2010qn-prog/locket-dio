const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 15 phút
  max: 10, // Tối đa 10 lần
  message: {
    status: 429,
    message: "Bạn đã đăng nhập quá nhiều lần. Vui lòng thử lại sau 1 tiếng.",
  },
  standardHeaders: true, // Gửi thông tin giới hạn trong header
  legacyHeaders: false,  // Tắt header X-RateLimit-*
});

module.exports = loginLimiter;
