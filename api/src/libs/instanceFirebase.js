const axios = require("axios");
const constants = require("../utils/constants");
const { firebase } = require("../config/app.config");

const AUTH_BASE =
  firebase.apiBase?.auth ||
  process.env.FIREBASE_AUTH_API_BASE ||
  "https://www.googleapis.com/identitytoolkit/v3/relyingparty";

const API_KEY = firebase.apiKey || process.env.FIREBASE_API_KEY || "";

const instanceFirebaseV2 = axios.create({
  baseURL: AUTH_BASE,
  timeout: 30000,
  params: API_KEY ? { key: API_KEY } : {},
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": constants.USER_AGENT,
    "X-Ios-Bundle-Identifier": constants.IOS_BUNDLE_ID,
  },
});

// Guard: thiếu key → lỗi rõ trước khi axios "Invalid URL"
instanceFirebaseV2.interceptors.request.use((config) => {
  if (!API_KEY) {
    const err = new Error(
      "FIREBASE_API_KEY chưa cấu hình. Thêm vào .env.development để login Locket."
    );
    err.status = 503;
    err.code = "FIREBASE_NOT_CONFIGURED";
    return Promise.reject(err);
  }
  if (!config.baseURL) {
    const err = new Error("FIREBASE_AUTH_API_BASE không hợp lệ");
    err.status = 503;
    err.code = "FIREBASE_AUTH_BASE_MISSING";
    return Promise.reject(err);
  }
  return config;
});

module.exports = { instanceFirebaseV2, isFirebaseConfigured: Boolean(API_KEY) };
