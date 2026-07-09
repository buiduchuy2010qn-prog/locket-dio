import api from "@/lib/axios";
import { instanceMain } from "@/lib/axios.main";
import { CONFIG } from "@/config";

//Login
export const loginV2 = async ({ email, password, captchaToken }) => {
  try {
    const res = await instanceMain.post("locket/loginV2", {
      email,
      password,
      captchaToken,
    });

    const payload = res?.data;

    // Proxy chưa chạy (Static Site trả HTML/empty) → hướng dẫn rõ
    if (payload == null || payload === "" || typeof payload === "string") {
      const err = new Error(
        "API proxy chưa chạy. Trên Render hãy tạo Web Service (Node) với Start: node server.mjs — không dùng Static Site."
      );
      err.status = 502;
      throw err;
    }

    // API Dio: { success: false, error: "Permission Denied" | message }
    if (payload.success === false) {
      const msg =
        (typeof payload.error === "string" && payload.error) ||
        payload.error?.message ||
        payload.message ||
        "Đăng nhập thất bại";
      const err = new Error(msg);
      err.status = payload.status || 400;
      err.code = payload.error?.code || payload.code;
      throw err;
    }

    // Lưu member token nếu login trả về session
    try {
      const { saveMemberSession } = await import("@/utils/memberToken");
      const root = payload.data || payload;
      if (root?.session) saveMemberSession(root.session);
      if (root?.member_token) saveMemberSession(root);
      if (payload?.session) saveMemberSession(payload.session);
    } catch (_) {
      /* ignore */
    }

    // Chuẩn hóa: một số bản API bọc trong .data, một số trả phẳng
    if (payload.data?.idToken || payload.data?.localId) {
      return payload;
    }
    if (payload.idToken || payload.localId) {
      return { data: payload, success: true };
    }

    const err = new Error(
      "Server không trả token đăng nhập. Kiểm tra Web Service proxy /dio-api."
    );
    err.status = 502;
    throw err;
  } catch (error) {
    if (error.status) throw error;
    if (error.response && error.response.data?.error) {
      const e = error.response.data.error;
      if (typeof e === "string") {
        const err = new Error(e);
        err.status = error.response.status || 400;
        throw err;
      }
      throw e;
    }
    if (error.response?.data?.message) {
      const err = new Error(error.response.data.message);
      err.status = error.response.status || 500;
      throw err;
    }
    console.error("❌ Network Error:", error.message);
    throw new Error(
      error.message ||
        "Có sự cố khi kết nối đến hệ thống, vui lòng thử lại sau ít phút."
    );
  }
};
export const refreshIdToken = async (refreshToken) => {
  try {
    const res = await instanceMain.post(
      "locket/refresh-token",
      { refreshToken },
      { withCredentials: true } // Nhận cookie từ server
    );
    // Kiểm tra nếu API trả về lỗi nhưng vẫn có status 200
    // if (res.data?.success === false) {
    //   console.error("Login failed:", res.data.message);
    //   return null;
    // }

    return res.data.idToken; // Trả về dữ liệu từ server
  } catch (error) {
    if (error.response && error.response.data?.error) {
      throw error.response.data.error; // ⬅️ Ném lỗi từ `error.response.data.error`
    }
    console.error("❌ Network Error:", error.message);
    throw new Error(
      "Có sự cố khi kết nối đến hệ thống, vui lòng thử lại sau ít phút."
    );
  }
};

export const forgotPassword = async (email) => {
  try {
    const body = { email };

    const res = await instanceMain.post("locket/resetPassword", body);

    return res.data;
  } catch (error) {
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error.message || "Yêu cầu thất bại!");
    } else if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    } else {
      console.error("❌ Network Error:", error.message);
      throw new Error(
        "Có sự cố khi kết nối đến hệ thống, vui lòng thử lại sau ít phút."
      );
    }
  }
};

//Logout
export const logout = async () => {
  try {
    const body = {
      author: CONFIG.app.name,
      client: CONFIG.app.clientVersion,
    };
    const response = await instanceMain.get("locket/logout", {});
    return response.data; // ✅ Trả về dữ liệu từ API (ví dụ: { message: "Đã đăng xuất!" })
  } catch (error) {
    console.error(
      "❌ Lỗi khi đăng xuất:",
      error.response?.data || error.message
    );
    throw error.response?.data || error.message; // ✅ Trả về lỗi nếu có
  }
};

export const GetUserData = async () => {
  try {
    const res = await api.get("/api/me");
    const data = res.data?.data ?? res.data;
    // Official client: session.member_token → header X-LocketDio-Member
    try {
      const { saveMemberSession } = await import("@/utils/memberToken");
      if (data?.session) saveMemberSession(data.session);
      else if (data?.member_token) saveMemberSession(data);
      // nested plan shapes
      if (data?.plan_info?.session) saveMemberSession(data.plan_info.session);
    } catch (_) {
      /* ignore */
    }
    return data;
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy thông tin người dùng:",
      error.response?.data || error.message
    );
    throw error.response?.data || error.message;
  }
};
