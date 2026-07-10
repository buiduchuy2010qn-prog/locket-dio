const { replaceFirebaseWithCDN } = require("../replace/replaceFirebaseWithCDN");

function parseFirestoreValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.mapValue !== undefined) {
    const fields = v.mapValue.fields || {};
    const obj = {};
    for (const key in fields) {
      obj[key] = parseFirestoreValue(fields[key]);
    }
    return obj;
  }
  if (v.arrayValue !== undefined) {
    return (v.arrayValue.values || []).map(parseFirestoreValue);
  }
  return null;
}

// 🔹 Chuẩn hoá 1 moment từ Firestore doc
function normalizeMoment(doc) {
  if (!doc || !doc.fields) return null;

  const f = doc.fields;
  const overlays = f.overlays?.arrayValue?.values || [];

  // chỉ lấy overlay đầu tiên (nếu có)
  const overlay = overlays[0]?.mapValue?.fields || {};
  const overlayData = overlay.data?.mapValue?.fields || {};

  const backgroundFields = overlayData.background?.mapValue?.fields || {};

  const getIsPublic = (f) => {
    const sentToAll = parseFirestoreValue(f.sent_to_all);
    const sentToSelfOnly = parseFirestoreValue(f.sent_to_self_only);

    // Ưu tiên sent_to_self_only nếu có true
    if (sentToSelfOnly) return false;
    if (sentToAll) return true;
    return false;
  };

  // type thật nằm trong data.type (music/poll/review/...),
  // overlay_type luôn là "caption" → nếu lấy nhầm sẽ mất MusicOverlay trên web
  const overlayId = overlay.overlay_id?.stringValue || null;
  const dataType =
    overlayData.type?.stringValue ||
    (overlayId === "caption:music" ? "music" : null) ||
    overlay.overlay_type?.stringValue ||
    null;

  return {
    id: f.canonical_uid?.stringValue || doc.name.split("/").pop(),
    caption: f.caption?.stringValue || overlay.alt_text?.stringValue || "",
    user: f.user?.stringValue || null,
    thumbnailUrl: replaceFirebaseWithCDN(f.thumbnail_url?.stringValue),
    videoUrl: replaceFirebaseWithCDN(f.video_url?.stringValue),
    image_url: replaceFirebaseWithCDN(
      f.thumbnail_url?.stringValue || f.image_url?.stringValue,
    ),
    md5: f.md5?.stringValue || null,
    date: f.date?.timestampValue || doc.createTime || null,
    isPublic: getIsPublic(f),
    overlays: {
      id: overlayId,
      overlay_id: overlayId,
      overlay_type: overlay.overlay_type?.stringValue || "caption",
      type: dataType,
      text: overlayData.text?.stringValue || null,
      text_color: overlayData.text_color?.stringValue || null,
      textColor: overlayData.text_color?.stringValue || null,
      maxLines: overlayData.max_lines?.integerValue
        ? parseInt(overlayData.max_lines.integerValue, 10)
        : null,
      background: {
        material_blur:
          overlayData.background?.mapValue?.fields?.material_blur
            ?.stringValue || null,
        materialBlur:
          overlayData.background?.mapValue?.fields?.material_blur
            ?.stringValue || null,
        colors: parseFirestoreValue(backgroundFields.colors) || [],
      },
      icon: parseFirestoreValue(overlayData.icon),
      payload: parseFirestoreValue(overlayData.payload) || {},
    },
    createTime: doc.createTime || null,
    updateTime: doc.updateTime || null,
  };
}

module.exports = {
  normalizeMoment,
  parseFirestoreValue,
};
