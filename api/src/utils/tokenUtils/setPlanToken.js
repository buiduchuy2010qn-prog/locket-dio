const { logInfo } = require("../logEventUtils");
const { verifyToken } = require("./signToken");

const COOKIE_NAME = "dioSession";

/**
 * Tạo JWT chứa thông tin plan và set vào cookie
 */
exports.setPlanCookie = (res, token) => {
  logInfo("SetCookie","Set cookie token plan!")

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    domain: ".locket-dio.com",
    path: "/",
  });

  return token;
};

/**
 * Giải mã cookie `dioSession` từ request
 */
exports.getPlanFromCookie = (req) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;

  try {
    return verifyToken(token);
  } catch {
    return null;
  }
};

/**
 * Xoá cookie `dioSession` (khi logout hoặc plan thay đổi)
 */
exports.clearPlanCookie = (res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
};
