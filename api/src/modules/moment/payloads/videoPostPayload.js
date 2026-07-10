const { getRandomCaptionId } = require("../../../utils/generate");
const { createBaseVideoPayload } = require("./createBasePayload");

const safeTrim = (value) => {
  return typeof value === "string" ? value.trim() : "";
};

const videoPostPayloadDefault = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { caption, text } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  const textTrimmed = safeTrim(caption) || safeTrim(text);

  // Không có caption => không gửi gì
  if (!textTrimmed) {
    return { data };
  }
  data.caption = textTrimmed;
  data.overlays.push({
    data: {
      text: caption,
      text_color: "#FFFFFFE6",
      type: "standard",
      max_lines: 4,
      background: {
        colors: [],
        material_blur: "ultra_thin",
      },
    },
    alt_text: textTrimmed,
    overlay_id: "caption:standard",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadDecorative = ({
  videoUrl,
  thumbnailUrl,
  optionsData,
}) => {
  const { overlay_id, text, text_color, background, icon } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  const textTrimmed = safeTrim(text);
  const hasIcon = icon && Object.keys(icon).length > 0;

  data.overlays.push({
    data: {
      text: textTrimmed,
      text_color: text_color,
      type: "static_content",
      max_lines: 1,
      ...(hasIcon && { icon }),
      background: {
        material_blur: "ultra_thin",
        colors: background.colors || [],
      },
    },
    alt_text: textTrimmed,
    overlay_id: `caption:${overlay_id}`,
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadStarSign = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { overlay_id, text, text_color, background, icon } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  const textTrimmed = safeTrim(text);

  data.overlays.push({
    data: {
      text: textTrimmed,
      text_color: text_color,
      type: "star_sign",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "1",
      },
      icon: icon,
      background: background || {},
    },
    alt_text: textTrimmed,
    overlay_id: "caption:star_sign",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadEffect = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { overlay_id, caption, text_color, color_top, color_bottom, icon } =
    optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  data.overlays.push({
    data: {
      text: caption,
      text_color: text_color,
      type: "static_content",
      max_lines: 1,
      icon: {
        type: "emoji",
        data: icon || "",
      },
      background: {
        material_blur: "ultra_thin",
        colors: [color_top, color_bottom],
      },
      effect: "snow",
    },
    alt_text: caption,
    overlay_id: `caption:ootd`,
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadImageIcon = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { text, text_color, background, icon } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  const randomCaptionId = getRandomCaptionId();

  const textTrimmed = safeTrim(text);

  data.overlays.push({
    data: {
      text: textTrimmed,
      text_color: text_color,
      type: "time",
      max_lines: 1,
      icon: icon,
      background: {
        colors: background.colors || [],
      },
    },
    alt_text: textTrimmed,
    overlay_id: "caption:time",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadCustome = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { text, text_color, background, icon } = optionsData;

  const data = createBaseVideoPayload({
    videoUrl,
    thumbnailUrl,
    optionsData,
  });

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
      max_lines: 1,
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

const videoPostPayloadTime = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { caption } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  function formatCaptionWithTimePeriod(caption) {
    const timeRegex = /(\b\d{1,2}):(\d{2})\b/;
    const match = caption.match(timeRegex);

    if (!match) return caption; // Không có định dạng giờ:phút → giữ nguyên

    let hour = parseInt(match[1], 10);
    const minute = match[2];
    let suffix = "";

    if (hour >= 0 && hour < 12) {
      suffix = "SA"; // Sáng
    } else {
      suffix = "CH"; // Chiều
    }

    const formattedTime = `${hour}:${minute} ${suffix}`;
    return caption.replace(timeRegex, formattedTime);
  }

  const formattedCaption = formatCaptionWithTimePeriod(caption);

  data.overlays.push({
    data: {
      text: formattedCaption,
      text_color: "#FFFFFFE6",
      type: "time",
      max_lines: 1,
      icon: {
        color: "#FFFFFFCC",
        data: "clock.fill",
        type: "sf_symbol",
      },
      background: {
        material_blur: "regular",
        colors: [],
      },
    },
    alt_text: formattedCaption,
    overlay_id: "caption:time",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadReview = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { payload } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  const { comment, rating } = payload;
  const reviewText = `★${rating} - "${comment}"`;

  data.overlays.push({
    data: {
      text: reviewText,
      text_color: "#FFFFFFE6",
      type: "review",
      max_lines: 1,
      payload: {
        comment: comment,
        rating: rating,
      },
      background: {
        material_blur: "regular",
        colors: [],
      },
    },
    alt_text: reviewText,
    overlay_id: "caption:review",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadMusic = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { caption, payload, icon } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  // 🧠 Tạo payload cơ bản
  const musicPayload = {
    preview_url: payload?.preview_url || payload?.audio || payload?.previewUrl,
    isrc: payload?.isrc,
    song_title: payload?.song_title || payload?.name || payload?.song_name,
    artist: payload?.artist,
  };

  // 🎧 Chỉ thêm khi có giá trị
  if (payload?.spotify_url) {
    musicPayload.spotify_url = payload.spotify_url;
  } else if (payload?.apple_music_url || payload?.appleMusicUrl) {
    musicPayload.apple_music_url =
      payload.apple_music_url || payload.appleMusicUrl;
  }

  data.overlays.push({
    data: {
      text: caption,
      text_color: "#FFFFFFE6",
      type: "music",
      max_lines: 1,
      payload: musicPayload,
      icon: icon,
      background: {
        material_blur: "ultra_thin",
        colors: [],
      },
    },
    alt_text: caption,
    overlay_id: "caption:music",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadBattery = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { caption, icon } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  function getBatteryIcon(level, charging) {
    if (charging) {
      return "battery.100.bolt"; // Chỉ có battery.100.bolt
    } else {
      if (level >= 80) return "battery.100";
      if (level >= 30) return "battery.25";
      if (level > 0) return "battery.0";
      return "battery.0.exclamationmark"; // Khi tụt quá thấp
    }
  }

  function getBatteryColor(level) {
    if (level <= 10) return "#FF0000"; // Đỏ
    if (level <= 30) return "#FFA500"; // Cam
    return "#00FF00"; // Xanh
  }

  const batteryText = `${caption}%`;

  data.overlays.push({
    data: {
      text: batteryText,
      text_color: "#FFFFFFE6",
      type: "time",
      max_lines: 1,
      icon: {
        color: getBatteryColor(caption),
        data: getBatteryIcon(caption, icon),
        type: "sf_symbol",
      },
      background: {
        material_blur: "regular",
        colors: [],
      },
    },
    alt_text: batteryText,
    overlay_id: "caption:time",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadHeart = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { caption } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  data.overlays.push({
    data: {
      text: caption,
      text_color: "#FFFFFFE6",
      type: "time",
      max_lines: 1,
      icon: {
        color: "#FF0000CC",
        data: "suit.heart.fill",
        type: "sf_symbol",
      },
      background: {
        material_blur: "regular",
        colors: [],
      },
    },
    alt_text: caption,
    overlay_id: "caption:time",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadStreak = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { text } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  data.overlays.push({
    data: {
      text: String(text),
      text_color: "#00000099",
      type: "streak",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "1",
      },
      icon: {
        color: "#00000099",
        data: "flame.fill",
        type: "sf_symbol",
      },
      background: {
        colors: ["#FFD25F", "#EAA900"],
      },
    },
    alt_text: String(text),
    overlay_id: "caption:streak",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadLocation = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { caption } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  data.overlays.push({
    data: {
      text: caption,
      text_color: "#FFFFFFE6",
      max_lines: 1,
      type: "location",
      icon: {
        color: "#24B0FF",
        data: "location.fill",
        type: "sf_symbol",
      },
      background: {
        material_blur: "regular",
        colors: [],
      },
    },
    alt_text: caption,
    overlay_id: "caption:location",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadWeather = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { text, text_color, caption, background, icon, payload } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

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

const videoPostPayloadPalette = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { text, text_color, payload } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

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

const videoPostPayloadPoll = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { text, text_color, payload, background } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

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
  videoPostPayloadDefault,
  videoPostPayloadDecorative,
  videoPostPayloadCustome,
  videoPostPayloadImageIcon,
  videoPostPayloadTime,
  videoPostPayloadReview,
  videoPostPayloadMusic,
  videoPostPayloadBattery,
  videoPostPayloadHeart,
  videoPostPayloadLocation,
  videoPostPayloadWeather,
  videoPostPayloadEffect,
  videoPostPayloadStreak,
  videoPostPayloadStarSign,
  videoPostPayloadPalette,
  videoPostPayloadPoll,
};
