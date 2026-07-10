const {
  parseFirestoreValue,
  getString,
  timestampToMillis,
  getBoolean,
  timestampToSeconds,
} = require("../utils/firestoreConverts");
const { replaceFirebaseWithCDN } = require("../utils/replaceFirebaseWithCDN");

function simplifyMoment(data) {
  const document = data.document_change?.document;
  const fields = document?.fields;

  if (!document || !fields) return null;

  const overlays = fields.overlays?.array_value?.values || [];

  // chỉ lấy overlay đầu tiên (nếu có)
  const overlay = overlays[0]?.map_value?.fields || {};
  const overlayData = overlay.data?.map_value?.fields || {};

  const backgroundFields = overlayData.background?.map_value?.fields || {};

  const getIsPublic = (fields) => {
    const sentToAll = parseFirestoreValue(fields.sent_to_all);
    const sentToSelfOnly = parseFirestoreValue(fields.sent_to_self_only);

    // Ưu tiên sent_to_self_only nếu có true
    if (sentToSelfOnly) return false;
    if (sentToAll) return true;
    return true;
  };

  const moment = {
    id: getString(fields.canonical_uid),
    canonical_uid: getString(fields.canonical_uid),
    group_id: getString(fields.group_id) || null,
    caption:
      fields.caption?.string_value || overlay.alt_text?.string_value || "",
    user: fields.user?.string_value || null,
    thumbnailUrl: replaceFirebaseWithCDN(getString(fields.thumbnail_url)),
    videoUrl: replaceFirebaseWithCDN(getString(fields.video_url)),
    md5: getString(fields.md5) || null,
    date: timestampToMillis(fields.date?.timestamp_value) || 0,
    isPublic: getIsPublic(fields),
    overlays: {
      overlay_id: getString(overlay.overlay_id),
      overlay_type: getString(overlay.overlay_type),
      type: getString(overlayData.type),
      text: getString(overlayData.text),
      text_color: getString(overlayData.text_color),
      max_lines: overlayData.max_lines?.integer_value
        ? parseInt(overlayData.max_lines.integer_value, 10)
        : null,
      background: {
        material_blur: parseFirestoreValue(backgroundFields?.material_blur) || null,
        colors: parseFirestoreValue(backgroundFields?.colors) || [],
        image: parseFirestoreValue(backgroundFields?.image) || {},
      },
      icon: parseFirestoreValue(overlayData.icon) || {},
      payload: parseFirestoreValue(overlayData.payload) || {},
    },
    isCelebrity: getBoolean(fields.from_celebrity) || false,
    from_celebrity: getBoolean(fields.from_celebrity) || false,
    createTime: timestampToSeconds(document.create_time) || 0,
    updateTime: timestampToSeconds(document.update_time) || 0,
  };

  return moment;
}

function simplifyReactions(data) {
  const document = data.document_change?.document || data;
  const fields = document?.fields;

  if (!document || !fields) return null;

  return {
    id: document.name.split("/").pop(),
    user: parseFirestoreValue(fields.user),
    emoji: parseFirestoreValue(fields.string),
    intensity: parseFirestoreValue(fields.intensity) ?? 0,
    createdAt: parseFirestoreValue(fields.created_at),
    createTime: timestampToSeconds(document.create_time),
    updateTime: timestampToSeconds(document.update_time),
  };
}

module.exports = { simplifyMoment, simplifyReactions };
