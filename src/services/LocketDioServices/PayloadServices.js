import { showError } from "@/components/Toast";
import { getToken } from "@/utils";
import { uploadFileAndGetInfoR2 } from "./StorageServices";
import { getStreakDataForPost } from "@/utils/moment/streak";
import {
  sanitizeMediaInfo,
  sanitizeOptionsData,
} from "@/utils/sanitizePostOptions";
/** Chuẩn hoá danh sách uid người nhận (string, bỏ rỗng/trùng). */
const normalizeRecipientIds = (list) => {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const r of list) {
    let id = null;
    if (typeof r === "string" && r.trim()) id = r.trim();
    else if (r && typeof r === "object") {
      id = r.uid || r.localId || r.userId || r.id || r.user || null;
      if (id != null) id = String(id).trim();
    } else if (typeof r === "number" && Number.isFinite(r)) {
      id = String(r);
    }
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
};

/**
 * Map audience UI → recipients + cờ Locket/Dio.
 * - all: sent_to_all, recipients rỗng
 * - selected: show_personally + danh sách uid đã chọn
 * - private: chỉ mình (localId)
 */
export const resolveAudiencePayload = (
  audience,
  selectedRecipients,
  localId
) => {
  const mode = audience === "private" || audience === "selected" ? audience : "all";
  let recipients = [];

  if (mode === "private") {
    recipients = localId ? [String(localId)] : [];
  } else if (mode === "selected") {
    recipients = normalizeRecipientIds(selectedRecipients);
    // Không gửi selected rỗng → Dio thường hiểu là all → ép private an toàn hơn
    if (recipients.length === 0 && localId) {
      return {
        audience: "private",
        recipients: [String(localId)],
        sent_to_all: false,
        show_personally: true,
      };
    }
  }

  return {
    audience: mode,
    recipients,
    sent_to_all: mode === "all",
    show_personally: mode === "selected" || mode === "private",
  };
};

/**
 * Payload postMomentV2 — sanitize chặt để tránh Dio 500
 * (caption object, streakData boolean, recipients object, …)
 * Drive backup: tự chạy ngay sau chụp (useAutoDriveBackup), không lặp lúc post.
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
    const audienceMeta = resolveAudiencePayload(
      audience,
      selectedRecipients,
      localId
    );

    const optionsData = sanitizeOptionsData(postOverlay || {}, {
      audience: audienceMeta.audience,
      recipients: audienceMeta.recipients,
      sent_to_all: audienceMeta.sent_to_all,
      show_personally: audienceMeta.show_personally,
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
