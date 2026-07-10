/**
 * Chuẩn hoá moment từ Firestore / API response.
 * Giữ overlays đầy đủ (type, payload, icon) để music/poll/review hiển thị.
 */
export function normalizeMoment(data) {
  if (!data || typeof data !== "object") return null;

  const {
    canonical_uid,
    id,
    user,
    userUid,
    image_url,
    imageUrl,
    video_url = null,
    videoUrl,
    thumbnail_url,
    thumbnailUrl,
    overlays = null,
    caption,
    md5,
    sent_to_all,
    show_personally,
    date,
    createTime,
    group_id,
    groupId,
  } = data;

  const momentId = canonical_uid || id || null;

  let dateVNString = null;
  let createTimeMs = createTime || 0;

  if (date?._seconds) {
    const firestoreDate = new Date(date._seconds * 1000);
    dateVNString = firestoreDate.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
    createTimeMs = createTimeMs || date._seconds * 1000;
  } else if (typeof date === "number") {
    createTimeMs = createTimeMs || date;
    dateVNString = new Date(date).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
  } else if (typeof date === "string") {
    dateVNString = date;
  }

  // Normalize overlays → object shape used by OverlayRenderer
  // (API simplifyMoment already returns object; Locket raw is array)
  let overlayObj = null;
  if (overlays && typeof overlays === "object" && !Array.isArray(overlays)) {
    overlayObj = {
      ...overlays,
      type: overlays.type || "caption",
      text: overlays.text || overlays.caption || "",
      payload: overlays.payload || {},
      icon: overlays.icon || {},
    };
  } else if (Array.isArray(overlays) && overlays.length > 0) {
    const first = overlays.find((o) => o?.overlay_type || o?.data) || overlays[0];
    const d = first?.data || first || {};
    overlayObj = {
      overlay_id: first?.overlay_id || d.overlay_id || d.type || "caption:standard",
      overlay_type: first?.overlay_type || "caption",
      type: d.type || "caption",
      text: d.text || first?.alt_text || caption || "",
      text_color: d.text_color,
      max_lines: d.max_lines,
      background: d.background || {},
      icon: d.icon || {},
      payload: d.payload || {},
    };
  }

  // Captions list (legacy UI)
  const captions = [];
  if (overlayObj?.text) {
    captions.push({
      text: overlayObj.text,
      text_color: overlayObj.text_color || "#FFFFFF",
      icon: overlayObj.icon || null,
      background: overlayObj.background || {
        material_blur: "ultra_thin",
        colors: [],
      },
      type: overlayObj.type,
      payload: overlayObj.payload,
    });
  } else if (typeof caption === "string" && caption.trim() !== "") {
    captions.push({
      text: caption,
      text_color: "#FFFFFF",
      icon: null,
      background: { material_blur: "ultra_thin", colors: [] },
    });
  }

  return {
    id: momentId,
    user: user || userUid || null,
    userUid: userUid || user || null,
    image_url: image_url || imageUrl || null,
    video_url: video_url || videoUrl || null,
    thumbnail_url: thumbnail_url || thumbnailUrl || image_url || imageUrl || null,
    date: dateVNString,
    createTime: createTimeMs,
    md5: md5 || null,
    sent_to_all: !!sent_to_all,
    show_personally: !!show_personally,
    group_id: group_id || groupId || null,
    captions,
    // Critical: keep overlays for MusicOverlay / Poll / Review
    overlays: overlayObj,
  };
}

/**
 * Build overlay object from post optionsData (local, after upload success).
 */
export function overlayFromOptionsData(optionsData) {
  if (!optionsData || typeof optionsData !== "object") return null;
  const type = optionsData.type || "default";
  if (type === "default" && !optionsData.caption && !optionsData.text) {
    return null;
  }
  return {
    overlay_id: optionsData.overlay_id || type,
    overlay_type: "caption",
    type: type === "default" ? "caption" : type,
    text: optionsData.text || optionsData.caption || "",
    text_color: optionsData.text_color || "#FFFFFFE6",
    background: optionsData.background || {
      material_blur: "ultra_thin",
      colors: [],
    },
    icon: optionsData.icon || {},
    payload: optionsData.payload || {},
    platform: optionsData.platform,
  };
}
