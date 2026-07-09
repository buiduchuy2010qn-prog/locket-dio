import axios from "axios";
import * as utils from "@/utils";
import api from "@/lib/axios";
import { formatApiError } from "@/utils/formatApiError";
import {
  sanitizeMediaInfo,
  sanitizeOptionsData,
} from "@/utils/sanitizePostOptions";

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

export const uploadMediaV2 = async (payload) => PostMoments(payload);

function buildPostMomentBody(payload) {
  const fileType = payload?.mediaInfo?.type || payload?.contentType || "image";

  const mediaInfo = sanitizeMediaInfo(
    payload?.mediaInfo || {},
    fileType,
    payload?.mediaInfo?.size
  );

  const src = payload?.optionsData || payload?.options || {};
  const audience =
    src.audience ||
    payload?.optionsData?.audience ||
    payload?.options?.audience ||
    "all";
  const recipients =
    src.recipients ||
    payload?.optionsData?.recipients ||
    payload?.options?.recipients ||
    src.allowed_users ||
    src.user_uids ||
    [];
  const sent_to_all =
    typeof src.sent_to_all === "boolean"
      ? src.sent_to_all
      : audience === "all";
  const show_personally =
    typeof src.show_personally === "boolean"
      ? src.show_personally
      : audience === "selected" || audience === "private";

  const optionsData = sanitizeOptionsData(src, {
    audience,
    recipients,
    sent_to_all,
    show_personally,
    streakData:
      typeof payload?.optionsData?.streakData === "number"
        ? payload.optionsData.streakData
        : typeof payload?.options?.streakData === "number"
          ? payload.options.streakData
          : null,
  });

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

    if (!body.mediaInfo?.url) {
      throw new Error("Thiếu mediaInfo.url — upload storage chưa xong.");
    }

    const timeoutId = setTimeout(() => {
      console.log("⏳ Uploading is taking longer than expected...");
    }, body.contentType === "video" ? 15000 : 10000);

    console.log("[postMomentV2]", {
      contentType: body.contentType,
      overlayType: body.optionsData?.type,
      captionType: typeof body.optionsData?.caption,
      caption: String(body.optionsData?.caption || "").slice(0, 40),
      streakData: body.optionsData?.streakData,
      audience: body.optionsData?.audience,
      recipients: body.optionsData?.recipients?.length || 0,
      sent_to_all: body.optionsData?.sent_to_all,
      show_personally: body.optionsData?.show_personally,
      hasUrl: !!body.mediaInfo?.url,
    });

    const response = await api.post(
      `${utils.API_URL.UPLOAD_MEDIA_URL_V2}`,
      body,
      {
        headers: { "Content-Type": "application/json" },
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
