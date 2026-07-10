const { createBaseImagePayload } = require("./createBasePayload");

// Đăng nền mặc định + caption
const imagePostPayloadDefault = ({ imageUrl, optionsData }) => {
  const { caption } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

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

// Đăng ảnh icon là hình ảnh
const imagePostPayloadImageIcon = ({ imageUrl, optionsData }) => {
  const { caption, text_color, color_top, color_bottom, icon } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const background = {
    material_blur: "ultra_thin",
    colors: color_top && color_bottom ? [color_top, color_bottom] : [],
  };

  data.overlays.push({
    data: {
      text: caption,
      text_color,
      type: "static_content",
      icon: { type: "image", data: icon, source: "url" },
      max_lines: 1,
      background,
    },
    alt_text: caption,
    overlay_id: "caption:ootd",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh kèm nền Decorative
const imagePostPayloadDecorative = ({ imageUrl, optionsData }) => {
  const { overlay_id, caption, text_color, color_top, color_bottom, icon } =
    optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  data.overlays.push({
    data: {
      text: caption,
      text_color,
      type: "static_content",
      icon: { type: "emoji", data: icon },
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "4",
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

// Đăng ảnh kèm icon + nền Tuỳ chỉnh
const imagePostPayloadCustome = ({ imageUrl, optionsData }) => {
  const { caption, text_color, color_top, color_bottom, icon } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  data.overlays.push({
    data: {
      text: caption,
      text_color,
      type: "static_content",
      icon: { type: "emoji", data: icon },
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "4",
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

// Đăng ảnh kèm nền tuỳ chỉnh
const imagePostPayloadBackGround = ({ imageUrl, optionsData }) => {
  const { caption, text_color, color_top, color_bottom, overlay_id } =
    optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  if (!caption) return { data };

  data.overlays.push({
    data: {
      text: caption,
      text_color,
      type: "static_content",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "4",
      },
      background: {
        material_blur: "ultra_thin",
        colors: [color_top, color_bottom],
      },
    },
    alt_text: caption,
    overlay_id: overlay_id || "caption:ootd",
    overlay_type: "caption",
  });

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
        artist: "DIO",
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
  const { caption, icon } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const text = `★${icon} - “${caption}”`;

  data.overlays.push({
    data: {
      text,
      text_color: "#FFFFFFE6",
      type: "review",
      max_lines: 1,
      payload: { comment: caption, rating: icon },
      background: { material_blur: "regular", colors: [] },
    },
    alt_text: text,
    overlay_id: "caption:review",
    overlay_type: "caption",
  });

  return { data };
};

// Đăng ảnh Music
const imagePostPayloadMusic = ({ imageUrl, optionsData }) => {
  const { caption, music } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

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
      payload, // ✅ Dùng payload đã xử lý ở trên
      icon: { type: "image", data: music?.image, source: "url" },
      background: { material_blur: "ultra_thin", colors: [] },
    },
    alt_text: caption,
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
  const { caption } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  data.overlays.push({
    data: {
      text: String(caption),
      text_color: "#00000099",
      type: "streak",
      max_lines: {
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
        value: "1",
      },
      icon: { color: "#00000099", data: "flame.fill", type: "sf_symbol" },
      background: { colors: ["#FFD25F", "#EAA900"] },
    },
    alt_text: String(caption),
    overlay_id: "caption:streak",
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
  const { caption } = optionsData;
  const data = createBaseImagePayload({ imageUrl, optionsData });

  const weatherMapping = {
    mostlyClear: { data: "sun.max.fill", colors: ["#2D9AFF", "#6BDCFF"] },
    cloudy: { data: "cloud.fill", colors: ["#7790A6", "#AAAAAA"] },
    foggy: { data: "cloud.fog.fill", colors: ["#A8B5B8", "#888C8E"] },
    heavyRain: { data: "cloud.rain.fill", colors: ["#5B86B2", "#93B1C4"] },
    thunderstorm: {
      data: "cloud.bolt.rain.fill",
      colors: ["#444B5B", "#777A8C"],
    },
    snowy: { data: "cloud.snow.fill", colors: ["#D0E3F0", "#FFFFFF"] },
  };

  const wk = caption?.wk_condition || "mostlyClear";
  const weatherStyle = weatherMapping[wk] || weatherMapping.mostlyClear;

  data.overlays.push({
    data: {
      text: `${caption?.temp_c_rounded}°C`,
      text_color: "#FFFFFFE6",
      max_lines: 1,
      payload: {
        temperature: caption?.temperature,
        cloud_cover: caption?.cloud_cover,
        is_daylight: caption?.is_daylight,
        wk_condition: wk,
      },
      type: "weather",
      icon: { color: "#FFFFFF", data: weatherStyle.data, type: "sf_symbol" },
      background: { colors: weatherStyle.colors },
    },
    alt_text: `${caption?.temp_c_rounded}°C`,
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
      effect: "snow"
    },
    alt_text: caption,
    overlay_id: "caption:ootd",
    overlay_type: "caption",
  });

  return { data };
};

module.exports = {
  imagePostPayloadDefault,
  imagePostPayloadDecorative,
  imagePostPayloadCustome,
  imagePostPayloadImageIcon,
  imagePostPayloadBackGround,
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
};
