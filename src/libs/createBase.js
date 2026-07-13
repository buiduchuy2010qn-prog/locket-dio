import axios from "axios";
import { CONFIG } from "@/config";
import { getToken, getMemberToken } from "@/utils";

// Meta của app gửi lên server
const APP_META = {
  "x-app-author": CONFIG.app.author,
  "x-app-name": CONFIG.app.shortname,
  "x-app-client": CONFIG.app.clientVersion,
  "x-app-api": CONFIG.app.apiVersion,
  "x-app-env": CONFIG.app.env,
};

// Hàm gắn headers chung
const attachHeaders = (config) => {
  const { idToken } = getToken();
  const member = getMemberToken();

  // Firebase idToken
  if (idToken) {
    config.headers["Authorization"] = `Bearer ${idToken}`;
  }

  // Member token của server bạn
  if (member?.token && member?.header) {
    config.headers[member.header] = member.token;
  }

  // App meta
  Object.assign(config.headers, APP_META);

  return config;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Render free cold start thường 20–60s — retry đủ dài + cả lỗi mạng (socket hang up)
const GATEWAY_RETRY_MAX = 6;
const GATEWAY_RETRY_DELAYS_MS = [2000, 3500, 5000, 8000, 10000, 12000];

function isGatewayOrNetworkError(error) {
  const status = error.response?.status || error.status;
  if (status === 502 || status === 503 || status === 504) return true;
  // Không có response = mạng / server đang spin-up
  if (!error.response) {
    const code = error.code || "";
    const msg = String(error.message || "").toLowerCase();
    if (
      code === "ECONNABORTED" ||
      code === "ERR_NETWORK" ||
      code === "ECONNRESET" ||
      code === "ETIMEDOUT" ||
      msg.includes("network") ||
      msg.includes("timeout") ||
      msg.includes("socket")
    ) {
      return true;
    }
  }
  return false;
}

/** Retry 502/503/504 + network errors (Render free cold start) */
function attachGatewayRetry(instance) {
  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const cfg = error.config;
      if (!cfg || !isGatewayOrNetworkError(error)) {
        return Promise.reject(error);
      }
      const attempt = cfg._gatewayRetry || 0;
      if (attempt >= GATEWAY_RETRY_MAX) return Promise.reject(error);
      cfg._gatewayRetry = attempt + 1;
      const delay =
        GATEWAY_RETRY_DELAYS_MS[
          Math.min(attempt, GATEWAY_RETRY_DELAYS_MS.length - 1)
        ];
      await sleep(delay);
      return instance(cfg);
    },
  );
}

// Tạo axios instance factory
export const createHttpClient = (baseURL) => {
  const instance = axios.create({
    baseURL,
    timeout: 45000,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CONFIG.keys.apiKey,
    },
  });

  instance.interceptors.request.use(attachHeaders, (error) =>
    Promise.reject(error),
  );
  attachGatewayRetry(instance);

  return instance;
};

export const createUploadClient = (baseURL) => {
  const instance = axios.create({
    baseURL,
    timeout: 45000,
    withCredentials: true,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CONFIG.keys.apiKey,
    },
  });

  instance.interceptors.request.use(attachHeaders);
  attachGatewayRetry(instance);
  return instance;
};
