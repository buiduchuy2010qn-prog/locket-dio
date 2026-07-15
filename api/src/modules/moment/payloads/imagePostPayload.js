const { getRandomCaptionId } = require("../../../utils/generate");
const { createBaseImagePayload } = require("./createBasePayload");

// Đăng nền mặc định + caption
const imagePostPayloadDefault = ({ imageUrl, optionsData }) => {
  const { caption, text: overlayText } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const text = caption?.trim() || overlayText?.trim() || "";

  // Không có caption => không gửi gì
  if (!text) {
    return { data };
  }

  data.caption = text;

  data.overlays.push({
    data: {
      text: text,
      text_color: "#FFFFFFE6",
      type: "standard",
      max_lines: 4,
      background: {
        material_blur: "ultra_thin",
        colors: [],
      },
    },
    alt_text: text,
    overlay_id: "caption:standard",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh icon là hình ảnh, gif, mẫu c
const imagePostPayloadIcon = ({ imageUrl, optionsData }) => {
  const { text, text_color, background, icon } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const randomId = getRandomCaptionId();

  data.overlays.push({
    data: {
      text: text,
      text_color,
      type: "time",
      icon,
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "1",
      },
      background: {
        colors: background.colors || [],
      },
    },
    alt_text: text,
    overlay_id: "caption:time",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh kèm nền Decorative by Locket
const imagePostPayloadDecorative = ({ imageUrl, optionsData }) => {
  const { overlay_id, text, text_color, background, icon } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const hasIcon = icon && Object.keys(icon).length > 0;

  data.overlays.push({
    data: {
      text: text,
      text_color,
      type: "static_content",
      ...(hasIcon && { icon }),
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "1",
      },
      background: background,
    },
    alt_text: text,
    overlay_id: `caption:${overlay_id}`,
    overlay_type: "caption",
  });
  
  return { data };
};

const imagePostPayloadStarSign = ({ imageUrl, optionsData }) => {
  const { overlay_id, text, text_color, background, icon } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const overlayText = text?.trim();

  data.overlays.push({
    data: {
      text: overlayText,
      text_color,
      type: "star_sign",
      icon,
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "1",
      },
      background: background || {},
    },
    alt_text: overlayText,
    overlay_id: "caption:star_sign",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh kèm icon + nền Tuỳ chỉnh
const imagePostPayloadCustome = ({ imageUrl, optionsData }) => {
  const { text, text_color, background, icon } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  // Không có text thì bỏ overlay
  if (!text || text.trim() === "") {
    return { data };
  }

  const randomId = getRandomCaptionId();

  // Overlay mặc định
  const overlay = {
    data: {
      text,
      text_color: text_color || "#FFFFFF",
      type: "static_content",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "1",
      },
      background: {
        material_blur: "ultra_thin",
        colors: background?.colors || [],
      },
    },
    alt_text: text,
    overlay_id: `caption:${randomId}`,
    overlay_type: "caption",
  };

  // Có icon thì thêm icon
  if (icon?.data) {
    overlay.data.icon = icon;
  }

  // Có background image thì đổi sang star_sign
  if (background?.image) {
    overlay.data.type = "star_sign";
    overlay.overlay_id = "caption:star_sign";
    overlay.data.background = background;
  }

  data.overlays.push(overlay);

  return { data };
};

// Đăng ảnh icon là hình ảnh (link)
const imagePostPayloadImageLink = ({ imageUrl, optionsData }) => {
  const { caption, text_color, color_top, color_bottom } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const background = {
    material_blur: "ultra_thin",
    colors: color_top && color_bottom ? [color_top, color_bottom] : [],
  };

  data.overlays.push({
    data: {
      text: caption,
      text_color,
      type: "music",
      icon: {
        type: "image",
        data: "https://res.cloudinary.com/diocloud/image/upload/v1747406421/icon_locket_default_shiga3.png",
        source: "url",
      },
      max_lines: 1,
      payload: {
        preview_url:
          "https://p.scdn.co/mp3-preview/f12389f941b1e55718b06911ce1768bac91ce0dc?cid=f71c515954d84560944cf58409f374a8",
        spotify_url: "https://www.instagram.com/_am.dio",
        isrc: "KRA402100040",
        song_title: "Bấm nút ở dưới để chuyển trang nhé haha :>",
        artist: "HUY",
      },
      background,
    },
    alt_text: caption,
    overlay_id: "caption:music",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh Time
const imagePostPayloadTime = ({ imageUrl, optionsData }) => {
  const { caption } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const formatCaptionWithTimePeriod = (text) => {
    const timeRegex = /(\b\d{1,2}):(\d{2})\b/;
    const match = text?.match(timeRegex);
    if (!match) return text;

    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const suffix = hour >= 0 && hour < 12 ? "SA" : "CH";
    return text.replace(timeRegex, `${hour}:${minute} ${suffix}`);
  };

  const formatted = formatCaptionWithTimePeriod(caption);

  data.overlays.push({
    data: {
      text: formatted,
      text_color: "#FFFFFFE6",
      type: "time",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "4",
      },
      icon: { color: "#FFFFFFCC", data: "clock.fill", type: "sf_symbol" },
      background: { material_blur: "regular", colors: [] },
    },
    alt_text: formatted,
    overlay_id: "caption:time",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh Review
const imagePostPayloadReview = ({ imageUrl, optionsData }) => {
  const { payload } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const { comment, rating } = payload;
  const text = `★${rating} - “${comment}”`;

  data.overlays.push({
    data: {
      text,
      text_color: "#FFFFFFE6",
      type: "review",
      max_lines: 1,
      payload: { comment: comment, rating: rating },
      background: { material_blur: "regular", colors: [] },
    },
    alt_text: text,
    overlay_id: "caption:review",
    overlay_type: "caption",
  });

  return { data };
};

/**
 * Music overlay — APP LOCKET CHÍNH HÃNG (format known-good 474aa184 / 28b98e58).
 *
 * Locket native chỉ hiện pill khi:
 * - isrc (12) + song_title + artist
 * - ĐÚNG 1 platform URL (XOR): Spotify HOẶC Apple — dual URL hay làm app bỏ overlay
 * - cover album (icon type image)
 * - text = TÊN BÀI thuần (app tự ghép · artist)
 * - max_lines: 1 (number)
 * - KHÔNG gửi preview_url (clip 30s / reject)
 */
const imagePostPayloadMusic = ({ imageUrl, optionsData }) => {
  const payload = optionsData?.payload || optionsData?.music || {};
  const { icon } = optionsData || {};
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const songTitle = String(
    payload?.song_title ||
      payload?.song_name ||
      payload?.name ||
      payload?.title ||
      "",
  )
    .trim()
    .split(/\s*[·|]\s*/)[0]
    .split(/\s+-\s+/)[0]
    .trim();
  const artist = String(payload?.artist || "").trim();

  if (!songTitle || /^music$/i.test(songTitle)) {
    const err = new Error(
      "Thiếu tên bài hát — app Locket chỉ hiện Music. Chọn lại bài từ Tìm nhạc.",
    );
    err.status = 400;
    throw err;
  }

  const isrcRaw = payload?.isrc
    ? String(payload.isrc).trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
    : "";
  const isrc =
    /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrcRaw) || /^[A-Z0-9]{12}$/.test(isrcRaw)
      ? isrcRaw
      : "";
  if (!isrc) {
    const err = new Error(
      "Thiếu mã ISRC — app Locket không hiện nhạc. Chọn lại bài từ tìm nhạc.",
    );
    err.status = 400;
    throw err;
  }

  let spotify_url = payload?.spotify_url || null;
  if (spotify_url) {
    const m = String(spotify_url).match(
      /(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?track\/|spotify:track:)([a-zA-Z0-9]{10,})/i,
    );
    if (m) spotify_url = `https://open.spotify.com/track/${m[1]}`;
    else spotify_url = String(spotify_url).split("?")[0] || null;
  }

  // Apple: giữ path + ?i= (album path OK) — không ép /song/ (có thể lệch catalog)
  let apple_music_url =
    payload?.apple_music_url || payload?.appleMusicUrl || null;
  if (apple_music_url) {
    try {
      const u = new URL(String(apple_music_url));
      const trackId = u.searchParams.get("i");
      let path = decodeURIComponent(u.pathname || "");
      if (!path.startsWith("/")) path = `/${path}`;
      path = path.replace(/\/album\/_\//i, "/album/track/");
      if (trackId && /\d{5,}/.test(trackId)) {
        apple_music_url = `https://music.apple.com${path}?i=${trackId}`;
      } else {
        // Không ?i= → bỏ, tránh badge Music trống
        apple_music_url = null;
      }
    } catch {
      apple_music_url = null;
    }
  }

  if (!spotify_url && !apple_music_url) {
    const err = new Error(
      "Thiếu link Spotify / Apple Music — app Locket không hiện nhạc.",
    );
    err.status = 400;
    throw err;
  }

  // Payload tối giản — đúng field Locket native đọc
  const musicPayload = {
    song_title: songTitle,
    song_name: songTitle,
    artist,
    isrc,
  };

  // XOR 1 platform — dual URL hay khiến app bỏ overlay (28b98e58)
  // Ưu tiên Apple (?i=) nếu có → iOS MusicKit; không thì Spotify (Android)
  if (apple_music_url && /[?&]i=\d{5,}/.test(String(apple_music_url))) {
    musicPayload.apple_music_url = apple_music_url;
  } else if (spotify_url) {
    musicPayload.spotify_url = spotify_url;
  } else if (apple_music_url) {
    musicPayload.apple_music_url = apple_music_url;
  }

  let cover =
    (icon && icon.data) ||
    payload?.image_url ||
    payload?.image ||
    payload?.thumbnail_url ||
    "";
  // Reject icon generic; cho phép mzstatic / scdn / iTunes
  if (
    !cover ||
    /cdn\.locket-dio\.com|caption-icon|spotify_music\.png/i.test(String(cover))
  ) {
    const err = new Error(
      "Thiếu ảnh bìa album — app Locket hay chỉ hiện chữ Music. Chọn lại bài có cover.",
    );
    err.status = 400;
    throw err;
  }

  data.overlays.push({
    data: {
      text: songTitle,
      text_color: "#FFFFFFE6",
      type: "music",
      max_lines: 1,
      payload: musicPayload,
      icon: {
        type: "image",
        data: cover,
        source: (icon && icon.source) || "url",
      },
      background: { material_blur: "ultra_thin", colors: [] },
    },
    alt_text: [songTitle, artist].filter(Boolean).join(" · ") || songTitle,
    overlay_id: "caption:music",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh Pin
const imagePostPayloadBattery = ({ imageUrl, optionsData }) => {
  const { caption, icon } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const getBatteryIcon = (level, charging) => {
    if (charging) return "battery.100.bolt";
    if (level >= 80) return "battery.100";
    if (level >= 30) return "battery.25";
    if (level > 0) return "battery.0";
    return "battery.0.exclamationmark";
  };

  const getBatteryColor = (level) => {
    if (level <= 10) return "#FF0000CC";
    if (level <= 30) return "#FFA500";
    return "#00FF00";
  };

  data.overlays.push({
    data: {
      text: `${caption}%`,
      text_color: "#FFFFFFE6",
      type: "time",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "4",
      },
      icon: {
        color: getBatteryColor(caption),
        data: getBatteryIcon(caption, icon),
        type: "sf_symbol",
      },
      background: { material_blur: "regular", colors: [] },
    },
    alt_text: `${caption}%`,
    overlay_id: "caption:time",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh kèm trái tim đỏ
const imagePostPayloadHeart = ({ imageUrl, optionsData }) => {
  const { caption } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  data.overlays.push({
    data: {
      text: caption,
      text_color: "#FFFFFFE6",
      type: "time",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "4",
      },
      icon: { color: "#FF0000CC", data: "suit.heart.fill", type: "sf_symbol" },
      background: { material_blur: "regular", colors: [] },
    },
    alt_text: caption,
    overlay_id: "caption:time",
    overlay_type: "caption",
  });

  return { data };
};

const imagePostPayloadStreak = ({ imageUrl, optionsData }) => {
  const { text } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  data.overlays.push({
    data: {
      text: String(text),
      text_color: "#00000099",
      type: "streak",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "1",
      },
      icon: { color: "#00000099", data: "flame.fill", type: "sf_symbol" },
      background: { colors: ["#FFD25F", "#EAA900"] },
    },
    alt_text: String(text),
    overlay_id: "caption:streak",
    overlay_type: "caption",
  });

  return { data };
};

/** Caption Lockets — pill vàng + ♥ + tổng số Locket (style giống streak) */
const imagePostPayloadLocketCount = ({ imageUrl, optionsData }) => {
  const count = String(
    optionsData?.text || optionsData?.caption || optionsData?.count || "1",
  );
  const data = createBaseImagePayload({ imageUrl, optionsData });

  data.overlays.push({
    data: {
      text: count,
      text_color: "#00000099",
      // Dùng type streak để app Locket render pill vàng solid;
      // icon suit.heart.fill phân biệt với chuỗi (flame).
      type: "streak",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "1",
      },
      icon: {
        color: "#00000099",
        data: "suit.heart.fill",
        type: "sf_symbol",
      },
      background: { colors: ["#FFD25F", "#EAA900"] },
    },
    alt_text: count,
    overlay_id: "caption:lockets",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh caption vị trí
const imagePostPayloadLocation = ({ imageUrl, optionsData }) => {
  const { caption } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  data.overlays.push({
    data: {
      text: caption,
      text_color: "#FFFFFFE6",
      max_lines: 1,
      payload: {},
      type: "location",
      icon: { color: "#24B0FF", data: "location.fill", type: "sf_symbol" },
      background: { material_blur: "regular", colors: [] },
    },
    alt_text: caption,
    overlay_id: "caption:location",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh caption thời tiết
const imagePostPayloadWeather = ({ imageUrl, optionsData }) => {
  const { text, text_color, caption, background, icon, payload } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  data.overlays.push({
    data: {
      text: text || caption,
      text_color: text_color,
      max_lines: 1,
      payload: {
        temperature: payload?.temperature,
        cloud_cover: payload?.cloud_cover,
        is_daylight: payload?.is_daylight,
        wk_condition: payload?.wk,
      },
      type: "weather",
      icon,
      background: { colors: background.colors || [] },
    },
    alt_text: text || caption,
    overlay_id: "caption:weather",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh Music
const imagePostPayloadLink = ({ imageUrl, optionsData }) => {
  const { caption, url } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  data.overlays.push({
    data: {
      text: "Intagram của mình nè :>",
      text_color: "#FFFFFFE6",
      type: "link",
      max_lines: 1,
      payload: {
        url: "https://youtu.be/gBBp5TIfQfg?si=SmiLMQbhNDLQtmF6",
      },
      icon: { data: "link", color: "#FFFFFFCC", type: "sf_symbol" },
      background: { material_blur: "regular", colors: [] },
    },
    alt_text: "Intagram của mình nè :>",
    overlay_id: "caption:link",
    overlay_type: "caption",
  });
  data.from_celebrity = true;

  return { data };
};

const imagePostPayloadEffect = ({ imageUrl, optionsData }) => {
  const { caption, text_color, color_top, color_bottom } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const background = {
    material_blur: "ultra_thin",
    colors: color_top && color_bottom ? [color_top, color_bottom] : [],
  };

  data.overlays.push({
    data: {
      text: caption,
      text_color: text_color,
      max_lines: 1,
      payload: {},
      type: "static_content",
      icon: { data: optionsData?.icon || "", type: "emoji" },
      background,
      effect: "snow",
    },
    alt_text: caption,
    overlay_id: "caption:ootd",
    overlay_type: "caption",
  });

  return { data };
};

const imagePostPayloadPalette = ({ imageUrl, optionsData }) => {
  const { text, text_color, payload } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const background = {
    material_blur: "ultra_thin",
    colors: [],
  };

  data.overlays.push({
    data: {
      text: text,
      text_color: text_color || "#FFFFFFE6",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "1",
      },
      payload,
      type: "color_palette",
      icon: { source: "local", data: "color_palette_icon", type: "image" },
      background,
    },
    alt_text: text,
    overlay_id: "caption:color_palette",
    overlay_type: "caption",
  });

  return { data };
};

const imagePostPayloadPoll = ({ imageUrl, optionsData }) => {
  const { text, text_color, payload, background } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const { left_emoji = "👍", right_emoji = "👎" } = payload || {};

  const altText = `${text} - ${left_emoji} ${right_emoji}`;

  data.overlays.push({
    data: {
      text: text,
      text_color: text_color || "#FFFFFFE6",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "2",
      },
      payload,
      type: "poll",
      background,
    },
    alt_text: altText,
    overlay_id: "caption:poll",
    overlay_type: "caption",
  });

  return { data };
};

module.exports = {
  imagePostPayloadDefault,
  imagePostPayloadDecorative,
  imagePostPayloadCustome,
  imagePostPayloadIcon,
  imagePostPayloadImageLink,
  imagePostPayloadTime,
  imagePostPayloadReview,
  imagePostPayloadMusic,
  imagePostPayloadBattery,
  imagePostPayloadHeart,
  imagePostPayloadLocation,
  imagePostPayloadWeather,
  imagePostPayloadLink,
  imagePostPayloadEffect,
  imagePostPayloadStreak,
  imagePostPayloadLocketCount,
  imagePostPayloadStarSign,
  imagePostPayloadPalette,
  imagePostPayloadPoll,
};
