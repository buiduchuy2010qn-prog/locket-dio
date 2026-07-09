import axios from "axios";
import * as utils from "@/utils";
import api from "@/lib/axios";
import { formatApiError } from "@/utils/formatApiError";

export const uploadMedia = async (formData, setUploadProgress) => {
  let timeOutId;
  try {
    const fileType = formData.get("images") ? "image" : "video";

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
    console.error("❌ Lỗi khi upload:", error.response?.data || error.message);
    throw error;
  }
};

export const uploadMediaV2 = async (payload) => {
  return PostMoments(payload);
};

/** Body postMomentV2 — chỉ field client chính thức. */
function buildPostMomentBody(payload) {
  const fileType = payload?.mediaInfo?.type || payload?.contentType || "image";
  let optionsData = { ...(payload?.optionsData || payload?.options || {}) };

  if (!optionsData.type) optionsData.type = "default";

  // Dio crash nếu streakData là boolean
  if (typeof optionsData.streakData === "boolean") {
    delete optionsData.streakData;
  }

  let mediaInfo = { ...(payload?.mediaInfo || {}) };
  delete mediaInfo.metadata;
  delete mediaInfo.downloadURL;

  // JSON-safe clone
  try {
    mediaInfo = JSON.parse(JSON.stringify(mediaInfo));
    optionsData = JSON.parse(JSON.stringify(optionsData));
  } catch {
    /* keep as-is */
  }

  return {
    model: payload?.model || "Version-UploadmediaV3.1",
    mediaInfo,
    contentType: payload?.contentType || fileType,
    optionsData,
  };
}

export const PostMoments = async (payload) => {
  try {
    const body = buildPostMomentBody(payload);
    const fileType = body.contentType;

    if (!body.mediaInfo || !body.mediaInfo.url) {
      throw new Error("Thiếu mediaInfo.url — upload storage chưa xong.");
    }
    if (!body.contentType) {
      throw new Error("Thiếu contentType (image/video).");
    }

    const timeoutDuration =
      fileType === "image" ? 10000 : fileType === "video" ? 15000 : 5000;
    const timeoutId = setTimeout(() => {
      console.log("⏳ Uploading is taking longer than expected...");
    }, timeoutDuration);

    console.log("[postMomentV2] body keys", {
      model: body.model,
      contentType: body.contentType,
      mediaType: body.mediaInfo?.type,
      hasUrl: !!body.mediaInfo?.url,
      hasKey: !!body.mediaInfo?.key,
      overlayType: body.optionsData?.type,
      streakData: body.optionsData?.streakData,
      audience: body.optionsData?.audience,
    });

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

    clearTimeout(timeoutId);

    if (response.data?.success === false) {
      const msg = formatApiError(
        { response, message: "postMoment bị từ chối" },
        "postMoment bị từ chối"
      );
      const err = new Error(msg);
      err.response = response;
      err.status = response.status;
      throw err;
    }

    console.log("✅ Upload thành công:", response.data);
    return response.data;
  } catch (error) {
    const pretty = formatApiError(error, "Lỗi khi đăng moment");
    console.error("❌ Lỗi khi upload:", pretty, error.response?.data || error);

    const e = new Error(pretty);
    e.response = error.response;
    e.status = error?.response?.status || error?.status;
    throw e;
  }
};
