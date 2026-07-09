import { showError } from "@/components/Toast";
import { getToken } from "@/utils";
import { uploadFileAndGetInfoR2 } from "./StorageServices";
import { getStreakToday } from "@/utils/moment/streak";

const determineRecipients = (audience, selectedRecipients, localId) => {
  if (audience === "selected") return selectedRecipients || [];
  if (audience === "private") return localId ? [localId] : [];
  return [];
};

/**
 * Khớp payload client chính thức locket-dio.com:
 * { model, mediaInfo, contentType, optionsData }
 * mediaInfo = { ...presignResponse, type }
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
    const isStreakToday = getStreakToday();

    if (!localId) {
      showError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      return null;
    }

    const mediaType = String(previewType || "image").toLowerCase();

    const uploaded = await uploadFileAndGetInfoR2(
      selectedFile,
      mediaType,
      localId
    );

    // Official: mediaInfo = { ...presignResponse, type } only
    const mediaInfo = {
      ...uploaded,
      type: mediaType,
    };
    // strip local helpers never sent by official client
    delete mediaInfo.metadata;
    delete mediaInfo.downloadURL;

    // Dio storage may return publicURL / publicUrl — postMoment needs `url`
    if (!mediaInfo.url) {
      mediaInfo.url =
        mediaInfo.publicURL ||
        mediaInfo.publicUrl ||
        mediaInfo.downloadURL ||
        null;
    }
    if (!mediaInfo.url) {
      throw new Error(
        "Presign không trả URL công khai (url). Thử đăng xuất/đăng nhập lại."
      );
    }

    // Official default overlay (Is) + audience/recipients
    const baseOverlay = {
      overlay_id: "standard",
      text: "",
      text_color: "#FFFFFF",
      icon: {},
      type: "default",
      background: { colors: [] },
      payload: {},
      caption: "",
      color_top: "",
      color_bottom: "",
      ...(postOverlay || {}),
    };
    // caption → text (official uses both)
    if (!baseOverlay.text && baseOverlay.caption) {
      baseOverlay.text = baseOverlay.caption;
    }
    if (!baseOverlay.type) baseOverlay.type = "default";
    // icon: official uses object; empty string breaks some overlay parsers
    if (baseOverlay.icon == null || baseOverlay.icon === "") {
      baseOverlay.icon = {};
    }

    const optionsData = {
      ...baseOverlay,
      audience: audience || "all",
      recipients: determineRecipients(audience, selectedRecipients, localId),
    };

    if (isStreakToday) {
      optionsData.streakData = isStreakToday;
    }

    // Official field name: optionsData
    return {
      model: "Version-UploadmediaV3.1",
      mediaInfo,
      contentType: mediaType,
      optionsData,
      // keep options alias for any legacy queue code
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
    };
    base.options = base.optionsData;
  }
  return base;
};
