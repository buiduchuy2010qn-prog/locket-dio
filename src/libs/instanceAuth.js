//Chủ yếu dùng cho các yêu cầu của khách truy cập và lấy dữ liệu xem trước
import { CONFIG } from "@/config";
import { getToken } from "@/utils";
import { createHttpClient } from "./createBase";

const BASE_URL = CONFIG.api.authUrl;

// Dùng createHttpClient để có retry cold-start (Render free 502/network)
export const instanceAuth = createHttpClient(BASE_URL || "/dio-api");

// Thêm interceptor để cập nhật Authorization trước mỗi request
instanceAuth.interceptors.request.use(
  (config) => {
    const { idToken } = getToken();
    if (idToken) {
      config.headers["Authorization"] = `Bearer ${idToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
