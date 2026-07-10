// utils/verifyCaptcha.js
const axios = require("axios");
const { logWarning } = require("./logEventUtils");

const verifyCaptcha = async (captchaToken, remoteIp) => {
  if (!captchaToken) {
    console.warn("❌ Thiếu mã xác thực CAPTCHA");
    return { success: false, message: "Thiếu mã xác thực CAPTCHA" };
  }

  try {
    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: captchaToken,
          remoteip: remoteIp,
        },
      }
    );

    if (!response.data.success) {
      logWarning("❌ Xác minh CAPTCHA thất bại:");
      return { success: false, message: "Xác minh CAPTCHA thất bại" };
    }

    return { success: true };
  } catch (error) {
    logWarning("❌ Lỗi khi xác minh CAPTCHA:", error.message);
    return { success: false, message: "Lỗi khi xác minh CAPTCHA" };
  }
};

module.exports = verifyCaptcha;
