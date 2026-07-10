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

/** Retry 502/503 (Render free cold start) */
function attachGatewayRetry(instance) {
  instance.interceptors.response.use(
    (res) => res,
    async (error) => {
      const status = error.response?.status || error.status;
      const cfg = error.config;
      if (!cfg || (status !== 502 && status !== 503 && status !== 504)) {
        return Promise.reject(error);
      }
      const attempt = cfg._gatewayRetry || 0;
      if (attempt >= 2) return Promise.reject(error);
      cfg._gatewayRetry = attempt + 1;
      await sleep(attempt === 0 ? 2500 : 5000);
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
