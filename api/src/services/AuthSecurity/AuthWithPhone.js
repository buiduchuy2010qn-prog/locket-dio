const { instanceLocketV2 } = require("../../libs");
const constants = require("../../utils/constants");
const { verifyCustomeToken } = require("./AuthServices");

const sendVerifiCode = async (phone) => {
  try {
    const body = {
      data: {
        phone,
        operation: "sign_in",
        platform: "ios",
        is_retry: false,
        use_password_if_available: true,
        client_token:
          process.env.LOCKET_CLIENT_TOKEN ||
          process.env.LOCKET_PHONE_CLIENT_TOKEN ||
          "",
        analytics: constants.locketAnalytics,
      },
    };

    const res = await instanceLocketV2.post("sendVerificationCode", body);

    const status = res?.data?.result?.status;

    return status;
  } catch (error) {
    // fallback network / http error
    if (error.response?.status) {
      return error.response.status;
    }

    throw error;
  }
};

const loginWithPhoneService = async (phone, password) => {
  try {
    const body = {
      data: {
        phone: phone,
        password: password,
        analytics: constants.locketAnalytics,
      },
    };
    const res = await instanceLocketV2.post("signInWithPhonePassword", body);
    const customToken = res.data.result.token || null;

    const result = await verifyCustomeToken(customToken);

    return result;
  } catch (error) {
    console.error("❌ Network Error:", error.message);
    // Chuẩn hoá error cho controller
    if (!error.status) {
      error.status = 500;
      error.message = "Lỗi khi đăng nhập bằng số điện thoại";
    }
    throw error; // ⬅️ CHỈ THROW
  }
};

const normalizePhone = (phone) => {
  if (phone.startsWith("0")) {
    return "+84" + phone.slice(1);
  }
  return phone;
};

module.exports = {
  sendVerifiCode,
  loginWithPhoneService,
  normalizePhone,
};
