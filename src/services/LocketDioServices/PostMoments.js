import axios from "axios";
import * as utils from "@/utils";
import api from "@/lib/axios";

export const uploadMedia = async (formData, setUploadProgress) => {
  let timeOutId;
  try {
    const fileType = formData.get("images") ? "image" : "video";

    // Thời gian chờ tùy vào loại file
    timeOutId = setTimeout(
      () => {
        console.log("⏳ Uploading is taking longer than expected...");
      },
      fileType === "image" ? 5000 : 10000
    );

    const response = await axios.post(
      utils.API_URL.UPLOAD_MEDIA_URL,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (setUploadProgress && typeof setUploadProgress === "function") {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            let currentProgress = 0;
            if (percent > currentProgress) {
              const updateProgress = (target) => {
                if (currentProgress < target) {
                  currentProgress += 1;
                  setUploadProgress(currentProgress);
                  setTimeout(() => updateProgress(target), 50);
                }
              };
              updateProgress(percent);
            }
          }
        },
      }
    );

    clearTimeout(timeOutId);
    console.log("✅ Upload thành công:", response.data);
    return response.data;
  } catch (error) {
    clearTimeout(timeOutId);

    // Log lỗi chi tiết hơn
    console.error("❌ Lỗi khi upload:", error.response?.data || error.message);

    if (error.response) {
      // Xử lý lỗi từ server
      console.error("Server Error:", error.response);
    } else {
      // Xử lý lỗi kết nối hoặc khác
      console.error("Network Error:", error.message);
    }

    throw error;
  }
};
export const uploadMediaV2 = async (payload) => {
  try {
    // Lấy mediaInfo từ payload
    const { mediaInfo } = payload;
    // Lấy type từ mediaInfo để xác định là ảnh hay video
    const fileType = mediaInfo.type;

    // Đặt timeout tùy theo loại tệp (ảnh hoặc video)
    const timeoutDuration =
      fileType === "image" ? 5000 : fileType === "video" ? 10000 : 5000;
    const timeoutId = setTimeout(() => {
      console.log("⏳ Uploading is taking longer than expected...");
    }, timeoutDuration);

    // Gửi request với payload và header Content-Type: application/json
    const response = await api.post(
      utils.API_URL.UPLOAD_MEDIA_URL_V2,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    clearTimeout(timeoutId); // Hủy timeout khi upload thành công
    console.log("✅ Upload thành công:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Lỗi khi upload:", error.response?.data || error.message);

    if (error.response) {
      console.error("📡 Server Error:", error.response);
    } else {
      console.error("🌐 Network Error:", error.message);
    }

    throw error;
  }
};
export const PostMoments = async (payload) => {
  try {
    // Lấy mediaInfo từ payload
    const { mediaInfo } = payload;
    // Lấy type từ mediaInfo để xác định là ảnh hay video
    const fileType = mediaInfo?.type || payload.contentType;

    // Đặt timeout tùy theo loại tệp (ảnh hoặc video)
    const timeoutDuration =
      fileType === "image" ? 10000 : fileType === "video" ? 15000 : 5000;
    const timeoutId = setTimeout(() => {
      console.log("⏳ Uploading is taking longer than expected...");
    }, timeoutDuration);

    // Chỉ gửi field client chính thức — bỏ id/status/createdAt của Dexie queue
    const optionsData = payload.optionsData || payload.options || {};
    if (!optionsData.type) optionsData.type = "default";

    const body = {
      model: payload.model || "Version-UploadmediaV3.1",
      mediaInfo: payload.mediaInfo,
      contentType: payload.contentType || fileType,
      optionsData,
    };

    if (!body.mediaInfo) {
      throw new Error("Thiếu mediaInfo — upload storage chưa xong.");
    }
    if (!body.contentType) {
      throw new Error("Thiếu contentType (image/video).");
    }

    // Gửi request; Authorization + member header do axios interceptor gắn
    const response = await api.post(
      `${utils.API_URL.UPLOAD_MEDIA_URL_V2}`,
      body,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 90000,
      }
    );

    clearTimeout(timeoutId); // Hủy timeout khi upload thành công

    // Dio đôi khi trả HTTP 200 + success:false
    if (response.data?.success === false) {
      const msg =
        response.data?.message ||
        response.data?.error?.message ||
        (typeof response.data?.error === "string"
          ? response.data.error
          : null) ||
        "postMoment bị từ chối";
      const err = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      err.response = response;
      throw err;
    }

    console.log("✅ Upload thành công:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Lỗi khi upload:", error.response?.data || error.message);

    if (error.response) {
      console.error("📡 Server Error:", error.response);
    } else {
      console.error("🌐 Network Error:", error.message);
    }

    // Bọc message API rõ ràng để toast queue hiển thị
    const apiMsg =
      error?.response?.data?.message ||
      error?.response?.data?.error?.message ||
      (typeof error?.response?.data?.error === "string"
        ? error.response.data.error
        : null);
    if (apiMsg && !error.message?.includes(String(apiMsg))) {
      const e = new Error(String(apiMsg));
      e.response = error.response;
      e.status = error?.response?.status;
      throw e;
    }

    throw error;
  }
};
