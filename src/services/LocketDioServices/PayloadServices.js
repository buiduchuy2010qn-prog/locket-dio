import { showError } from "@/components/Toast";
import { getToken } from "@/utils";
import { uploadFileAndGetInfoR2 } from "./StorageServices";
import { getStreakDataForPost } from "@/utils/moment/streak";
import {
  sanitizeMediaInfo,
  sanitizeOptionsData,
} from "@/utils/sanitizePostOptions";

const determineRecipients = (audience, selectedRecipients, localId) => {
  if (audience === "selected") return selectedRecipients || [];
  if (audience === "private") return localId ? [localId] : [];
  return [];
};

/**
 * Payload postMomentV2 — sanitize chặt để tránh Dio 500
 * (caption object, streakData boolean, recipients object, …)
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

    const mediaInfo = sanitizeMediaInfo(
      uploaded,
      mediaType,
      selectedFile?.size
    );

    const streakData = getStreakDataForPost();
    const optionsData = sanitizeOptionsData(postOverlay || {}, {
      audience: audience || "all",
      recipients: determineRecipients(audience, selectedRecipients, localId),
      streakData,
    });

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
