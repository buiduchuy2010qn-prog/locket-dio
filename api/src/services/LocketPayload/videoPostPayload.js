const { createBaseVideoPayload } = require("./createBasePayload");

const videoPostPayloadDefault = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { caption } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  if (caption?.trim()) {
    data.caption = caption;
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
      alt_text: caption,
      overlay_id: "caption:standard",
      overlay_type: "caption",
    });
  }

  return { data };
};

const videoPostPayloadDecorative = ({
  videoUrl,
  thumbnailUrl,
  optionsData,
}) => {
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
        data: icon,
      },
      background: {
        material_blur: "ultra_thin",
        colors: [color_top, color_bottom],
      },
    },
    alt_text: caption,
    overlay_id: `caption:${overlay_id}`,
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

const videoPostPayloadCustome = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { caption, text_color, color_top, color_bottom, icon } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  data.overlays.push({
    data: {
      text: caption,
      text_color: text_color,
      type: "static_content",
      max_lines: 1,
      icon: {
        type: "emoji",
        data: icon,
      },
      background: {
        material_blur: "ultra_thin",
        colors: [color_top, color_bottom],
      },
    },
    alt_text: caption,
    overlay_id: "caption:miss_you",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadBackGround = ({
  videoUrl,
  thumbnailUrl,
  optionsData,
}) => {
  const { overlay_id, caption, text_color, color_top, color_bottom } =
    optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  // Chỉ thêm overlay khi có caption
  if (caption) {
    data.overlays.push({
      data: {
        text: caption,
        text_color: text_color,
        type: "static_content",
        max_lines: 1,
        background: {
          material_blur: "ultra_thin",
          colors: [color_top, color_bottom],
        },
      },
      alt_text: caption,
      overlay_id: "caption:ootd",
      overlay_type: "caption",
    });
  }

  return { data };
};

const videoPostPayloadImageIcon = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { caption, text_color, color_top, color_bottom, icon } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  // Chỉ thêm colors nếu cả hai colorTop và colorBottom không rỗng
  const background = {
    material_blur: "ultra_thin",
    colors: color_top && color_bottom ? [color_top, color_bottom] : [],
  };

  data.overlays.push({
    data: {
      text: caption,
      text_color: text_color,
      type: "static_content",
      max_lines: 1, // Ghi đè max_lines thành 1
      icon: {
        type: "image",
        data: icon,
        source: "url",
      },
      background: background,
    },
    alt_text: caption,
    overlay_id: "caption:ootd",
    overlay_type: "caption",
  });

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
  const { caption, icon } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  const reviewText = `★${icon} - "${caption}"`;

  data.overlays.push({
    data: {
      text: reviewText,
      text_color: "#FFFFFFE6",
      type: "review",
      max_lines: 1,
      payload: {
        comment: caption,
        rating: icon,
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
  const { caption, music } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  // 🧠 Tạo payload cơ bản
  const payload = {
    preview_url: music?.preview_url || music?.audio || music?.previewUrl,
    isrc: music?.isrc,
    song_title: music?.name,
    artist: music?.artist,
  };

  // 🎧 Chỉ thêm khi có giá trị
  if (music?.spotify_url) {
    payload.spotify_url = music.spotify_url;
  } else if (music?.apple_music_url || music?.appleMusicUrl) {
    payload.apple_music_url = music.apple_music_url || music.appleMusicUrl;
  }

  data.overlays.push({
    data: {
      text: caption,
      text_color: "#FFFFFFE6",
      type: "music",
      max_lines: 1,
      payload,
      icon: {
        type: "image",
        data: music.image,
        source: "url",
      },
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

const videoPostPayloadLocketCount = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const count = String(
    optionsData?.text || optionsData?.caption || optionsData?.count || "1",
  );
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  data.overlays.push({
    data: {
      text: count,
      text_color: "#00000099",
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
      background: {
        colors: ["#FFD25F", "#EAA900"],
      },
    },
    alt_text: count,
    overlay_id: "caption:lockets",
    overlay_type: "caption",
  });

  return { data };
};

const videoPostPayloadStreak = ({ videoUrl, thumbnailUrl, optionsData }) => {
  const { caption } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  data.overlays.push({
    data: {
      text: String(caption),
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
    alt_text: String(caption),
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
  const { caption } = optionsData;
  const data = createBaseVideoPayload({ videoUrl, thumbnailUrl, optionsData });

  // Mapping wk_condition -> icon + background colors
  const weatherMapping = {
    mostlyClear: {
      data: "sun.max.fill",
      colors: ["#2D9AFF", "#6BDCFF"],
    },
    cloudy: {
      data: "cloud.fill",
      colors: ["#7790A6", "#AAAAAA"],
    },
    foggy: {
      data: "cloud.fog.fill",
      colors: ["#A8B5B8", "#888C8E"],
    },
    heavyRain: {
      data: "cloud.rain.fill",
      colors: ["#5B86B2", "#93B1C4"],
    },
    thunderstorm: {
      data: "cloud.bolt.rain.fill",
      colors: ["#444B5B", "#777A8C"],
    },
    snowy: {
      data: "cloud.snow.fill",
      colors: ["#D0E3F0", "#FFFFFF"],
    },
  };

  const wk = caption?.wk_condition || "mostlyClear";
  const weatherStyle = weatherMapping[wk] || weatherMapping["mostlyClear"];
  const tempText = `${caption?.temp_c_rounded}°C`;

  data.overlays.push({
    data: {
      text: tempText,
      text_color: "#FFFFFFE6",
      max_lines: 1,
      payload: {
        temperature: caption?.temperature,
        cloud_cover: caption?.cloud_cover,
        is_daylight: caption?.is_daylight,
        wk_condition: wk,
      },
      type: "weather",
      icon: {
        color: "#FFFFFF",
        data: weatherStyle.data,
        type: "sf_symbol",
      },
      background: {
        colors: weatherStyle.colors,
      },
    },
    alt_text: tempText,
    overlay_id: "caption:weather",
    overlay_type: "caption",
  });

  return { data };
};

module.exports = {
  videoPostPayloadDefault,
  videoPostPayloadDecorative,
  videoPostPayloadCustome,
  videoPostPayloadBackGround,
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
  videoPostPayloadLocketCount,
};
