import { showError } from "@/components/Toast";
import { getToken } from "@/utils";
import { uploadFileAndGetInfoR2 } from "./StorageServices";
import { getStreakDataForPost } from "@/utils/moment/streak";

const determineRecipients = (audience, selectedRecipients, localId) => {
  if (audience === "selected") return selectedRecipients || [];
  if (audience === "private") return localId ? [localId] : [];
  return [];
};

/** Chỉ giữ field JSON thuần (tránh Dexie/React rác gây 500 phía Dio). */
function plainJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

/**
 * Khớp payload client chính thức locket-dio.com:
 * { model, mediaInfo, contentType, optionsData }
 * mediaInfo = { ...presignResponse, type }
 * streakData = yyyymmdd number | omit (KHÔNG được là boolean true)
 */
export const createRequestPayloadV5 = async (
  selectedFile,
  previewType,
  postOverlay,
  audience,
  selectedRecipients
) => {
  try {
    const { localId } = getToken() || {};

    if (!localId) {
      showError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      return null;
    }

    const mediaType = String(previewType || "image").toLowerCase();
    if (mediaType !== "image" && mediaType !== "video") {
      throw new Error(`contentType không hợp lệ: ${mediaType}`);
    }

    const uploaded = await uploadFileAndGetInfoR2(
      selectedFile,
      mediaType,
      localId
    );

    // Official: mediaInfo = { ...r.data.data, type } — full storage response
    const mediaInfo = plainJson({
      ...uploaded,
      type: mediaType,
    });
    // helpers chỉ dùng local
    delete mediaInfo.metadata;
    delete mediaInfo.downloadURL;

    // Chuẩn hoá url (storage có thể trả publicURL)
    if (!mediaInfo.url) {
      mediaInfo.url =
        mediaInfo.publicURL || mediaInfo.publicUrl || mediaInfo.downloadURL;
    }
    if (!mediaInfo.url) {
      throw new Error(
        "Presign không trả URL công khai (url). Thử đăng xuất/đăng nhập lại."
      );
    }
    // path alias (một số bản Dio đọc path)
    if (!mediaInfo.path && mediaInfo.key) {
      mediaInfo.path = mediaInfo.key;
    }
    if (!mediaInfo.size && selectedFile?.size) {
      mediaInfo.size = selectedFile.size;
    }

    // Official overlay store defaults (Is)
    const overlay = plainJson(postOverlay || {}) || {};
    const optionsData = {
      overlay_id: overlay.overlay_id || "standard",
      text: overlay.text || overlay.caption || "",
      text_color: overlay.text_color || "#FFFFFF",
      // default overlay dùng object; caption icon có thể là string/url object
      icon:
        overlay.icon === "" || overlay.icon == null
          ? {}
          : overlay.icon,
      type: overlay.type || "default",
      background: overlay.background || { colors: [] },
      payload: overlay.payload || {},
      caption: overlay.caption || overlay.text || "",
      color_top: overlay.color_top || "",
      color_bottom: overlay.color_bottom || "",
      // giữ field phụ nếu studio set (music, location, ...)
      ...(overlay.music != null && overlay.music !== ""
        ? { music: overlay.music }
        : {}),
      ...(overlay.platform ? { platform: overlay.platform } : {}),
      audience: audience || "all",
      recipients: determineRecipients(audience, selectedRecipients, localId),
    };

    // Official: streakData = yyyymmdd number when NOT yet posted today
    const streakData = getStreakDataForPost();
    if (streakData != null) {
      optionsData.streakData = streakData;
    }

    // Guard: never send boolean streakData (Dio 500 INTERNAL_SERVER_ERROR)
    if (typeof optionsData.streakData === "boolean") {
      delete optionsData.streakData;
    }

    return {
      model: "Version-UploadmediaV3.1",
      mediaInfo,
      contentType: mediaType,
      optionsData,
      options: optionsData,
    };
  } catch (error) {
    console.error("Lỗi khi tạo payload:", error);
    throw error;
  }
};

export const createRequestPayloadV4 = async (
  selectedFile,
  previewType,
  postOverlay,
  restoreStreak,
  audience,
  selectedRecipients
) => {
  const base = await createRequestPayloadV5(
    selectedFile,
    previewType,
    postOverlay,
    audience,
    selectedRecipients
  );
  if (!base) return null;
  if (restoreStreak) {
    base.optionsData = {
      ...base.optionsData,
      restoreStreakDate: restoreStreak,
      restoreStreakData: restoreStreak,
    };
    base.options = base.optionsData;
  }
  return base;
};
