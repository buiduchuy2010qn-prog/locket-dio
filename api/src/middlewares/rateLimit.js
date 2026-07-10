const rateLimit = require("express-rate-limit");

// Limiter cho các API POST/PUT/DELETE — giới hạn cao hơn
const apiLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 phút
  max: 100, // Tối đa 100 request/IP
  message: {
    error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limiter riêng cho các API GET — thường cần nhẹ hơn
const getLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 phút
  max: 30, // Tối đa 30 request/IP/phút cho GET
  handler: (req, res, next, options) => {
    res.status(429).json({
      status: 429,
      success: false,
      error: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});
const refreshLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  handler: (req, res, next, options) => {
    res.status(429).json({
      status: 429,
      success: false,
      error: "Bạn đang gửi yêu cầu quá nhiều. Vui lòng thử lại sau 1 giờ.",
    });
  },
});
const loginV2Limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Tối đa 20 request/IP trong 15 phút
  standardHeaders: true, // Gửi thông tin rate limit qua header (tùy chọn nhưng hữu ích)
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json({
      status: 429,
      success: false,
      error: "Bạn đang gửi yêu cầu quá nhiều. Vui lòng thử lại sau 15 phút.",
    });
  },
});
const rejectLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // ⏱ 24 giờ
  max: 10, // 🎯 Chỉ cho phép 1 request
  standardHeaders: true, // Gửi thông tin rate limit qua header (tùy chọn nhưng hữu ích)
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      status: 429,
      success: false,
      message: "Bạn chỉ được gửi yêu cầu 10 lần mỗi ngày. Vui lòng thử lại sau 24 giờ.",
    });
  },
});

module.exports = {
  apiLimiter,
  getLimiter,
  refreshLimiter,
  loginV2Limiter,
  rejectLimiter
};
