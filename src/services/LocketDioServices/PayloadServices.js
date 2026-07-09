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

    // Official: spread full storage response + type
    const mediaInfo = {
      ...uploaded,
      type: previewType,
      // ensure url field for consumers
      url:
        uploaded.publicURL ||
        uploaded.publicUrl ||
        uploaded.url ||
        uploaded.downloadURL,
      path: uploaded.key || uploaded.path || uploaded.metadata?.path,
      name: uploaded.metadata?.name || uploaded.name,
      size: uploaded.metadata?.size || selectedFile?.size,
    };

    // remove nested helpers that may confuse backend
    delete mediaInfo.metadata;
    delete mediaInfo.downloadURL;

    const optionsData = {
      caption: postOverlay?.caption || "",
      overlay_id: postOverlay?.overlay_id || "standard",
      type: postOverlay?.type || "default",
      icon: postOverlay?.icon || "",
      text_color: postOverlay?.text_color || "#FFFFFF",
      color_top: postOverlay?.color_top || "",
      color_bottom: postOverlay?.color_bottom || "",
      audience: audience || "all",
      recipients: determineRecipients(audience, selectedRecipients, localId),
      music: postOverlay?.music || "",
    };

    if (isStreakToday) {
      optionsData.streakData = isStreakToday;
    } else {
      optionsData.isStreaktoday = false;
    }

    // Official field name: optionsData (not options)
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
