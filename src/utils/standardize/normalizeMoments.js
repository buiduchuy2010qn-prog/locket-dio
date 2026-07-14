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
  let createTimeMs =
    typeof createTime === "number" && Number.isFinite(createTime)
      ? createTime
      : 0;

  const safeLocale = (ms) => {
    try {
      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    } catch {
      return null;
    }
  };

  const sec =
    date?._seconds ??
    date?.seconds ??
    (typeof date === "object" && typeof date?.toMillis === "function"
      ? null
      : null);

  if (typeof sec === "number" && Number.isFinite(sec)) {
    createTimeMs = createTimeMs || sec * 1000;
    dateVNString = safeLocale(sec * 1000);
  } else if (typeof date?.toMillis === "function") {
    try {
      const ms = date.toMillis();
      if (Number.isFinite(ms)) {
        createTimeMs = createTimeMs || ms;
        dateVNString = safeLocale(ms);
      }
    } catch {
      /* ignore */
    }
  } else if (typeof date === "number" && Number.isFinite(date)) {
    // seconds (~1e9) vs ms (~1e12)
    const ms = date < 1e12 && date > 1e9 ? date * 1000 : date;
    createTimeMs = createTimeMs || ms;
    dateVNString = safeLocale(ms);
  } else if (typeof date === "string" && date.trim()) {
    const parsed = Date.parse(date);
    if (!Number.isNaN(parsed)) {
      createTimeMs = createTimeMs || parsed;
      dateVNString = safeLocale(parsed);
    } else {
      // Đã là chuỗi hiển thị (vi-VN) — giữ text, không gán createTime
      dateVNString = date;
    }
  }

  // createTime có thể là seconds
  if (
    createTimeMs > 0 &&
    createTimeMs < 1e12 &&
    createTimeMs > 1e9
  ) {
    createTimeMs = createTimeMs * 1000;
  }

  // Normalize overlays → object shape used by OverlayRenderer
  // (API simplifyMoment already returns object; Locket raw is array)
  let overlayObj = null;
  if (overlays && typeof overlays === "object" && !Array.isArray(overlays)) {
    const oid = overlays.overlay_id || overlays.id || null;
    // REST normalize đôi khi gán type = overlay_type ("caption") — suy ra music từ id/payload
    let resolvedType = overlays.type || null;
    if (
      !resolvedType ||
      resolvedType === "caption" ||
      resolvedType === "standard"
    ) {
      if (oid === "caption:music" || oid === "music") resolvedType = "music";
      else if (oid === "caption:review" || oid === "review")
        resolvedType = "review";
      else if (oid === "caption:color_palette") resolvedType = "color_palette";
      else if (overlays.payload?.isrc || overlays.payload?.song_title)
        resolvedType = "music";
      else resolvedType = resolvedType || "caption";
    }
    overlayObj = {
      ...overlays,
      overlay_id: oid,
      type: resolvedType,
      text: overlays.text || overlays.caption || "",
      payload: overlays.payload || {},
      icon: overlays.icon || {},
    };
  } else if (Array.isArray(overlays) && overlays.length > 0) {
    const first = overlays.find((o) => o?.overlay_type || o?.data) || overlays[0];
    const d = first?.data || first || {};
    const oid =
      first?.overlay_id || d.overlay_id || d.type || "caption:standard";
    let resolvedType = d.type || null;
    if (!resolvedType || resolvedType === "caption") {
      if (oid === "caption:music" || oid === "music") resolvedType = "music";
      else if (d.payload?.isrc || d.payload?.song_title) resolvedType = "music";
      else resolvedType = "caption";
    }
    overlayObj = {
      overlay_id: oid,
      overlay_type: first?.overlay_type || "caption",
      type: resolvedType,
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
