const crypto = require("crypto");
const { getYYYYMMDD } = require("../../../helpers/dayHelpers");
const { logInfo } = require("../../../utils/logEventUtils");
const { createAnalytics } = require("../../../services/LocketAnalytics");
const { generateUUIDv4Upper } = require("../../../utils/generate");

const getMd5Hash = (str) => {
  return crypto.createHash("md5").update(str).digest("hex");
};

const createIntValue = (value) => ({
  "@type": "type.googleapis.com/google.protobuf.Int64Value",
  value: value.toString(),
});

/**
 * Tạo payload cơ bản cho ảnh hoặc video
 */
const createBasePayload = ({
  mediaUrl,
  thumbnailUrl,
  optionsData,
  isVideo = false,
}) => {
  const { recipients, audience, sentToGroupId, restoreStreakDate, streakData, selectedGroupId } =
    optionsData;
  logInfo("createBasePayload", "Bắt đầu khởi tạo payload");
  const payload = {
    thumbnail_url: thumbnailUrl || mediaUrl, // nếu ảnh thì chính là mediaUrl
    md5: getMd5Hash(mediaUrl),
    //show_personally: false,
    // analytics: createAnalytics(),
    overlays: [],
  };

  const normalizeRecipients = Array.isArray(recipients)
    ? recipients
    : recipients
      ? [recipients]
      : [];

  if (selectedGroupId) {
    payload.sent_to_self_only = false;
    payload.sent_to_all = false;
    payload.group = {
      id: selectedGroupId,
      group_conversation_only: false,
    };
  } else if (sentToGroupId) {
    payload.sent_to_self_only = false;
    payload.sent_to_all = false;
    payload.group = {
      id: sentToGroupId,
      group_conversation_only: true,
      message_client_token: generateUUIDv4Upper(),
    };
  } else if (audience === "private") {
    payload.sent_to_self_only = true;
    payload.sent_to_all = false;
  } else if (normalizeRecipients.length > 0) {
    payload.sent_to_self_only = false;
    payload.sent_to_all = false;
    payload.recipients = normalizeRecipients;
  } else {
    payload.sent_to_self_only = false;
    payload.sent_to_all = true;
    payload.recipients = [];
  }

  // Nếu là video thì thêm các trường riêng
  if (isVideo) {
    payload.video_url = mediaUrl;
  }

  // ⚙️ Ưu tiên recoveryStreakDate nếu có, nếu không thì xét isStreaktoday
  if (restoreStreakDate?.data) {
    logInfo(
      "restoreStreakDate",
      "Nhận yêu cầu khôi phục chuỗi",
      restoreStreakDate,
    );
    if (restoreStreakDate?.mode === "restore") {
      payload.restore_streak_for_yyyymmdd = createIntValue(
        restoreStreakDate.data,
      );
    } else {
      payload.update_streak_for_yyyymmdd = createIntValue(getYYYYMMDD());
    }
  }

  if (streakData) {
    logInfo("streakData", "Nhận dữ liệu streak trong payload", streakData);
    payload.update_streak_for_yyyymmdd = createIntValue(streakData);
  }

  return payload;
};

/**
 * Tạo payload cho ảnh
 */
const createBaseImagePayload = ({ imageUrl, optionsData }) =>
  createBasePayload({ mediaUrl: imageUrl, optionsData, isVideo: false });

/**
 * Tạo payload cho video (sử dụng chung base)
 */
const createBaseVideoPayload = ({ videoUrl, thumbnailUrl, optionsData }) =>
  createBasePayload({
    mediaUrl: videoUrl,
    thumbnailUrl,
    optionsData,
    isVideo: true,
  });

module.exports = {
  createBasePayload,
  createBaseImagePayload,
  createBaseVideoPayload,
};
