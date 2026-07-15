import api from "@/libs/axios";
import { getPushSubscription } from "../BrowserServices";
import { instanceAuth } from "@/libs";

export const updateUserInfo = async (user) => {
  try {
    const body = {
      uid: user?.localId,
      username: user?.username || user?.email || "user",
      email: user?.email,
      display_name: user?.displayName || user?.email,
      profile_picture: user?.photoURL || user?.profilePicture || "",
    };

    await instanceAuth.post("/api/u", body);
  } catch (err) {
    console.error("❌ Failed to update user info:", err);
  }
};

export const GetUserData = async () => {
  try {
    const res = await api.get("/api/me");
    return res.data?.data;
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy thông tin người dùng:",
      error.response?.data || error.message,
    );
    throw error.response?.data || error.message;
  }
};

export const GetUserDataV2 = async () => {
  try {
    const res = await api.get("/api/cn");
    return res.data?.data;
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy thông tin người dùng:",
      error.response?.data || error.message,
    );
    throw error.response?.data || error.message;
  }
};

/** Persist client-computed upload stats (from published posts) to API */
export const syncUploadStatsToServer = async (stats) => {
  try {
    const res = await api.post("/api/upload-stats/sync", stats || {});
    return res.data?.data || stats;
  } catch (error) {
    console.warn(
      "[upload-stats] sync to server failed:",
      error?.response?.data || error?.message,
    );
    return stats;
  }
};

export const GetInfoFamily = async () => {
  try {
    const res = await api.get("/api/getInfoFamily");
    return res.data?.data;
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy thông tin người dùng:",
      error.response?.data || error.message,
    );
    throw error.response?.data || error.message;
  }
};

export const syncPushSubscription = async () => {
  try {
    const sub = await getPushSubscription();
    if (!sub) return;

    const body = {
      app: "huylocket",
      type: "webpush",
      data: sub,
    };

    await instanceAuth.post("/api/setNotificationToken", body);
  } catch (err) {
    console.error("Push sync error:", err);
  }
};
