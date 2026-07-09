/**
 * Chuẩn hoá optionsData trước khi gửi postMomentV2.
 * Dio 500 nếu caption/text/icon/recipients sai kiểu (object thay vì string).
 */

function asString(value, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    // weather object cũ: { temp_c_rounded, icon, condition }
    if (value.temp_c_rounded != null) return `${value.temp_c_rounded}°C`;
    if (typeof value.title === "string") return value.title;
    if (typeof value.text === "string") return value.text;
    if (typeof value.name === "string") return value.name;
    if (typeof value.caption === "string") return value.caption;
    if (typeof value.label === "string") return value.label;
    if (typeof value.address === "string") return value.address;
  }
  return fallback;
}

function normalizeRecipients(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((r) => {
      if (typeof r === "string" && r) return r;
      if (r && typeof r === "object") {
        return r.uid || r.localId || r.userId || r.id || r.user || null;
      }
      return null;
    })
    .filter((x) => typeof x === "string" && x.length > 0);
}

function normalizeIcon(icon, type) {
  if (icon == null || icon === "") {
    return type === "review" ? 0 : {};
  }
  if (typeof icon === "number") return icon;
  if (typeof icon === "boolean") return {};
  if (typeof icon === "string") return icon;
  if (typeof icon === "object") {
    // { data, type, source } hoặc { url }
    if (icon.data || icon.url || icon.type) return icon;
    return {};
  }
  return {};
}

function normalizeBackground(bg) {
  if (!bg || typeof bg !== "object") return { colors: [] };
  const colors = Array.isArray(bg.colors)
    ? bg.colors.filter((c) => typeof c === "string")
    : [];
  return { ...bg, colors };
}

/**
 * @param {object} overlay - postOverlay từ UI
 * @param {object} opts
 * @param {string} opts.audience
 * @param {array} opts.recipients
 * @param {number|null} opts.streakData - yyyymmdd or null
 */
export function sanitizeOptionsData(overlay = {}, opts = {}) {
  const raw = overlay && typeof overlay === "object" ? overlay : {};
  let type = typeof raw.type === "string" ? raw.type : "default";

  // caption object (weather cũ, v.v.) → ép string; nếu type default mà caption object thì về default sạch
  const captionWasObject =
    raw.caption != null &&
    typeof raw.caption === "object" &&
    !Array.isArray(raw.caption);

  let caption = asString(raw.caption, "");
  let text = asString(raw.text, caption);

  // Các type đặc biệt Dio dễ 500 nếu payload lệch → fallback default an toàn
  // (vẫn giữ caption string nếu user đã gõ)
  const riskyTypes = new Set([
    "weather",
    "music",
    "image_icon",
    "image_gif",
    "image_link",
    "special",
    "custome",
    "decorative",
  ]);

  // Nếu caption từng là object và type weather → caption đã là "25°C"
  if (captionWasObject && type === "default") {
    type = "default";
  }

  // Music: giữ music object trong field music, caption = title string
  let music = undefined;
  if (raw.music && typeof raw.music === "object") {
    music = raw.music;
    if (!caption && raw.music.title) caption = asString(raw.music.title);
    if (type !== "music") type = "music";
  }

  // payload chỉ object thuần
  let payload = {};
  if (raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)) {
    try {
      payload = JSON.parse(JSON.stringify(raw.payload));
    } catch {
      payload = {};
    }
  }

  // Với type rủi ro thiếu cấu trúc chính thức → đăng như default (vẫn hiện caption chữ)
  if (riskyTypes.has(type) && type !== "music") {
    // weather/location/time vẫn OK nếu caption là string đơn giản
    if (type === "weather" || type === "location" || type === "time" || type === "battery" || type === "heart" || type === "review") {
      // giữ type
    } else {
      type = "default";
    }
  }

  const optionsData = {
    overlay_id:
      typeof raw.overlay_id === "string" && raw.overlay_id
        ? raw.overlay_id
        : "standard",
    text: text || caption || "",
    text_color:
      typeof raw.text_color === "string" && raw.text_color
        ? raw.text_color
        : "#FFFFFF",
    icon: normalizeIcon(raw.icon, type),
    type,
    background: normalizeBackground(raw.background),
    payload,
    caption: caption || text || "",
    color_top: typeof raw.color_top === "string" ? raw.color_top : "",
    color_bottom: typeof raw.color_bottom === "string" ? raw.color_bottom : "",
    audience: opts.audience || raw.audience || "all",
    recipients: normalizeRecipients(
      opts.recipients != null ? opts.recipients : raw.recipients
    ),
  };

  if (music) optionsData.music = music;
  if (raw.platform && typeof raw.platform === "string") {
    optionsData.platform = raw.platform;
  }

  // streakData: chỉ number yyyymmdd
  if (typeof opts.streakData === "number" && Number.isFinite(opts.streakData)) {
    optionsData.streakData = opts.streakData;
  }

  // Final hard guards
  if (typeof optionsData.caption !== "string") optionsData.caption = "";
  if (typeof optionsData.text !== "string") optionsData.text = "";
  if (typeof optionsData.streakData === "boolean") delete optionsData.streakData;

  return optionsData;
}

/**
 * Giữ gần như nguyên response storage (official: ...r.data.data + type).
 * Chỉ bỏ helper local. Không whitelist hẹp — Dio có thể cần field phụ.
 */
export function sanitizeMediaInfo(raw, mediaType, fileSize) {
  let data = {};
  try {
    data = JSON.parse(JSON.stringify(raw || {}));
  } catch {
    data = { ...(raw || {}) };
  }

  delete data.metadata;
  delete data.downloadURL;

  const uploadUrl = typeof data.uploadUrl === "string" ? data.uploadUrl : "";

  // url công khai — không để nhầm uploadUrl (PUT-only → 404 "Không thể tải media từ URL")
  let url =
    data.url ||
    data.publicURL ||
    data.publicUrl ||
    data.downloadURL ||
    data.downloadUrl ||
    null;

  if (url && uploadUrl && url === uploadUrl) {
    url =
      data.publicURL ||
      data.publicUrl ||
      data.downloadURL ||
      data.downloadUrl ||
      url;
  }

  // Nếu url vẫn là presigned PUT (có Signature), thử field khác
  if (
    typeof url === "string" &&
    /X-Amz-Signature|X-Amz-Credential/i.test(url) &&
    uploadUrl &&
    url === uploadUrl
  ) {
    // giữ nguyên — một số backend chỉ trả 1 URL (hiếm)
  }

  data.url = url;
  if (!data.path && data.key) data.path = data.key;
  if (!data.size && fileSize) data.size = fileSize;
  data.type = mediaType;

  if (!data.url || typeof data.url !== "string" || !data.url.startsWith("http")) {
    throw new Error(
      "Presign không trả URL công khai (url). Thử đăng xuất/đăng nhập lại."
    );
  }

  // Cảnh báo dev: Dio GET vào uploadUrl sẽ 404
  if (uploadUrl && data.url === uploadUrl) {
    console.warn(
      "[mediaInfo] url === uploadUrl — Dio có thể 404 khi tải media. Response keys:",
      Object.keys(data)
    );
  }

  return data;
}
