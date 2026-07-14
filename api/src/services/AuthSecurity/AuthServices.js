const axios = require("axios");
const constants = require("../../utils/constants");
const { instanceFirebaseV2 } = require("../../libs/instanceFirebase");
const { createGoogleInstance, instanceLocketV2 } = require("../../libs");
const { firebase } = require("../../config/app.config");

// Hàm xử lý đăng nhập
const handleLogin = async (email, password) => {
  const loginPayload = {
    email,
    password,
    returnSecureToken: true,
    iosBundleId: constants.IOS_BUNDLE_ID,
  };
  const response = await instanceFirebaseV2.post(
    "verifyPassword",
    loginPayload,
  );
  return response.data;
};

// Hàm xử lý đăng nhập
const verifyCustomeToken = async (token) => {
  const verifyPayload = {
    token,
    returnSecureToken: true,
  };
  const response = await instanceFirebaseV2.post(
    "verifyCustomToken",
    verifyPayload,
  );

  return response.data;
};

// Hàm xử lý đăng nhập
const CheckEmail = async (email) => {
  const apiKey = firebase.apiKey || process.env.FIREBASE_API_KEY || "";
  if (!apiKey) {
    const err = new Error(
      "FIREBASE_API_KEY chưa cấu hình. Thêm vào .env / Railway Variables.",
    );
    err.status = 503;
    err.code = "FIREBASE_NOT_CONFIGURED";
    throw err;
  }

  const loginPayload = {
    identifier: email,
    continueUri: "http://localhost",
    iosBundleId: constants.IOS_BUNDLE_ID,
  };

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": constants.USER_AGENT,
    "X-Ios-Bundle-Identifier": constants.IOS_BUNDLE_ID,
  };

  const response = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
    loginPayload,
    {
      headers,
    },
  );

  return response.data;
};

const refreshIdToken = async (refreshToken) => {
  const body = {
    grantType: "refresh_token",
    refreshToken: refreshToken,
  };

  try {
    const firebaseAuthApi = createGoogleInstance("secureToken");

    const res = await firebaseAuthApi.post("v1/token", body);

    // Firebase trả về object gồm: id_token, refresh_token, expires_in, user_id,...
    return res.data;
  } catch (err) {
    console.error("Refresh token failed:", err.response?.data || err.message);
    throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
  }
};

// Hàm xử lý thay đổi thông tin profile
const handleChangeProfileInfo = async (
  idToken,
  badge,
  celebrity,
  additionalData = {},
) => {
  // Payload cho API
  const profilePayload = {
    data: {
      badge,
      celebrity,
      ...additionalData,
    },
  };

  // Gửi yêu cầu tới Locket API
  const response = await instanceLocketV2.post(
    "/changeProfileInfo",
    profilePayload,
    {
      meta: {
        idToken: idToken,
      },
    },
  );

  // Trả về dữ liệu từ response
  return response.data;
};

const ResetPassword = async (email) => {
  const body = {
    data: {
      email: email,
    },
  };

  try {
    const response = await instanceLocketV2.post(
      "/sendPasswordResetEmail",
      body,
    );
    console.log(response.data);

    const statusCode = response.data?.result?.status || 500;
    const message = response.data?.result?.message || "Unknown error";

    return {
      success: statusCode === 200,
      statusCode,
      message,
      raw: response.data,
    };
  } catch (error) {
    const errMsg =
      error.response?.data?.result?.message ||
      error.message ||
      "Request failed";

    console.error("❌ Lỗi khi gửi yêu cầu Reset Password:", errMsg);

    return {
      success: false,
      statusCode: error.response?.status || 500,
      message: errMsg,
      raw: error.response?.data || null,
    };
  }
};

module.exports = {
  handleLogin,
  verifyCustomeToken,
  refreshIdToken,
  handleChangeProfileInfo,
  ResetPassword,
  CheckEmail,
};
