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

    const uploaded = await uploadFileAndGetInfoR2(
      selectedFile,
      previewType,
      localId
    );

    // Official: mediaInfo = { ...presignResponse, type } only
    const mediaInfo = {
      ...uploaded,
      type: previewType,
    };
    // strip local helpers never sent by official client
    delete mediaInfo.metadata;
    delete mediaInfo.downloadURL;

    // Official: optionsData = { ...overlayData, audience, recipients }
    const optionsData = {
      ...(postOverlay || {}),
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
      contentType: previewType,
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
