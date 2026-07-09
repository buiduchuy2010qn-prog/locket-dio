import { PUBLIC_API } from "@/config/apiConfig";
import { instanceBaseData } from "@/lib/axios.data";

/**
 * Lấy danh sách hoặc chi tiết bài viết.
 * @param {string} [slug] - slug của bài viết (nếu có).
 */
export const getListNewFeeds = async (slug) => {
  try {
    const url = slug ? `${PUBLIC_API.feeds}?slug=${slug}` : PUBLIC_API.feeds;
    const res = await instanceBaseData.get(url);

    if (!res?.data) {
      console.error("❌ Không có dữ liệu hợp lệ", res?.data);
      return null;
    }

    if (!slug && Array.isArray(res.data)) {
      return [...res.data].sort(
        (a, b) => new Date(b.published_at) - new Date(a.published_at)
      );
    }

    return res.data;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API:", error.message);
    return null;
  }
};
export const getListDonates = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.donations);
    return res.data;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API:", error.message);
    return null;
  }
};

export const getListIncidents = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.incidents);
    return res.data;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API:", error.message);
    return null;
  }
};

export const getAllTimelines = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.timelines);
    return res.data;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API:", error.message);
    return null;
  }
};
export const getAllFrameCamera = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.frames);
    return res.data;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API:", error.message);
    return null;
  }
};
export const getListCelebrity = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.celebrates);
    return res.data;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API:", error.message);
    return null;
  }
};
export const getNotifications = async () => {
  try {
    const res = await instanceBaseData.get(PUBLIC_API.notifications);
    return res;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi API:", error.message);
    return null;
  }
};

export const GetListInfoPlans = async () => {
  try {
    const response = await instanceBaseData.get(PUBLIC_API.plans);

    return response.data;
  } catch (error) {
    console.error("Error fetching upload stats:", error);
    throw error;
  }
};
export const GetInfoPlanWithId = async (planId) => {
  try {
    const url = `${PUBLIC_API.plans}/${planId}`;
    const response = await instanceBaseData.get(url);

    return response.data;
  } catch (error) {
    console.error("Error fetching upload stats:", error);
    throw error;
  }
};

/**
 * Normalize one overlay item from getAllOverlaysV2 → UI preset shape
 */
export const normalizeOverlayItem = (item) => {
  if (!item || item.active === false) return null;

  const colors = item.background?.colors || [];
  const color_top = colors[0] || item.color_top || "#333333";
  const color_bottom = colors[1] || colors[0] || item.color_bottom || "#111111";

  let icon = "";
  if (item.icon?.type === "emoji" && item.icon?.data) {
    icon = String(item.icon.data);
  } else if (typeof item.icon === "string") {
    icon = item.icon;
  }

  const bgImage =
    item.background?.image?.source === "url"
      ? item.background.image.data
      : item.icon?.type === "image" && item.icon?.source === "url"
        ? item.icon.data
        : "";

  const rawText = item.text != null ? String(item.text).trim() : "";
  // Editable color themes often have empty text — user types caption after select
  const prettyId = item.overlay_id
    ? String(item.overlay_id)
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Caption";
  const caption = rawText || (item.is_editable ? prettyId : prettyId);

  return {
    preset_id: item.overlay_id || item.id || `preset_${Math.random()}`,
    caption,
    preset_caption: caption,
    // empty caption on select for pure color themes
    apply_caption: rawText || (item.is_editable ? "" : caption),
    color_top,
    color_bottom,
    top: color_top,
    color_bot: color_bottom,
    text_color: item.text_color || "#FFFFFF",
    color_text: item.text_color || "#FFFFFF",
    icon,
    type: item.type || "default",
    bg_image: bgImage,
    is_editable: item.is_editable !== false,
    order_index: item.order_id ?? 999,
    raw: item,
  };
};

/** Built-in captions if API fails */
export const FALLBACK_CAPTION_PRESETS = {
  background: [
    {
      preset_id: "galaxy",
      caption: "Galaxy",
      color_top: "#5733FF",
      color_bottom: "#FF33B5",
      text_color: "#FFFFFF",
      icon: "✨",
      type: "custom",
    },
    {
      preset_id: "peachy",
      caption: "Peachy",
      color_top: "#FF9500",
      color_bottom: "#FF2D95",
      text_color: "#FFFFFF",
      icon: "🍑",
      type: "custom",
    },
    {
      preset_id: "sunset",
      caption: "Sunset",
      color_top: "#FF5733",
      color_bottom: "#FFC300",
      text_color: "#FFFFFF",
      icon: "🌅",
      type: "custom",
    },
    {
      preset_id: "ocean",
      caption: "Ocean",
      color_top: "#0077B6",
      color_bottom: "#00B4D8",
      text_color: "#FFFFFF",
      icon: "🌊",
      type: "custom",
    },
    {
      preset_id: "mint",
      caption: "Mint",
      color_top: "#11998e",
      color_bottom: "#38ef7d",
      text_color: "#FFFFFF",
      icon: "🌿",
      type: "custom",
    },
    {
      preset_id: "love",
      caption: "Love",
      color_top: "#FF416C",
      color_bottom: "#FF4B2B",
      text_color: "#FFFFFF",
      icon: "❤️",
      type: "custom",
    },
  ],
  decorative: [
    {
      preset_id: "pride",
      caption: "PRIDE",
      color_top: "#E40303",
      color_bottom: "#FF8C00",
      text_color: "#FFFFFF",
      icon: "🏳️‍🌈",
      type: "decorative",
    },
    {
      preset_id: "besties",
      caption: "Besties",
      color_top: "#F953C6",
      color_bottom: "#B91D73",
      text_color: "#FFFFFF",
      icon: "👯",
      type: "decorative",
    },
    {
      preset_id: "vibes",
      caption: "Good Vibes",
      color_top: "#00C9FF",
      color_bottom: "#92FE9D",
      text_color: "#0a0a0a",
      icon: "😎",
      type: "decorative",
    },
  ],
  custome: [
    {
      preset_id: "wedding_times",
      caption: "Wedding Time!",
      color_top: "#FFE4E1",
      color_bottom: "#E73C7E",
      text_color: "#FFFFFF",
      icon: "💍",
      type: "template",
    },
    {
      preset_id: "miss_you",
      caption: "Miss you",
      color_top: "#667eea",
      color_bottom: "#764ba2",
      text_color: "#FFFFFF",
      icon: "🥺",
      type: "template",
    },
    {
      preset_id: "coffee",
      caption: "Coffee first",
      color_top: "#3E2723",
      color_bottom: "#8D6E63",
      text_color: "#FFFFFF",
      icon: "☕",
      type: "template",
    },
    {
      preset_id: "good_night",
      caption: "Good night",
      color_top: "#0F2027",
      color_bottom: "#2C5364",
      text_color: "#FFFFFF",
      icon: "🌙",
      type: "template",
    },
  ],
  special: [
    {
      preset_id: "star_aries",
      caption: "Bạch Dương",
      color_top: "#FF2400",
      color_bottom: "#FF5733",
      text_color: "#FFFFFF",
      icon: "♈",
      type: "star_sign",
    },
    {
      preset_id: "star_leo",
      caption: "Sư Tử",
      color_top: "#F9D423",
      color_bottom: "#FF4E50",
      text_color: "#FFFFFF",
      icon: "♌",
      type: "star_sign",
    },
    {
      preset_id: "happy",
      caption: "Happy day!",
      color_top: "#F7971E",
      color_bottom: "#FFD200",
      text_color: "#1a1a1a",
      icon: "🎉",
      type: "special",
    },
  ],
  image_icon: [],
  image_gif: [],
  season: [],
};

/**
 * Map section_id from API → UI group keys used by CustomeStudio
 */
const SECTION_TO_GROUP = {
  caption_season: "season",
  suggest: "background",
  decorative: "decorative",
  decorative_by_locketdio: "custome",
  star_sign: "special",
};

/**
 * Fetch caption overlays (official getAllOverlaysV2)
 * Returns grouped presets for Customize studio
 */
export const getAllOverlayCaption = async () => {
  try {
    // Prefer V2 (official). themes endpoint is dead (404).
    let res;
    try {
      res = await instanceBaseData.get(PUBLIC_API.overlaysV2);
    } catch (e1) {
      console.warn("overlaysV2 failed, try legacy themes", e1?.message);
      res = await instanceBaseData.get(PUBLIC_API.themes);
    }

    const data = res?.data;
    if (!data) {
      console.error("❌ Không có dữ liệu overlay");
      return null;
    }

    // V2: array of sections { section_id, name, items[] }
    if (Array.isArray(data) && data[0]?.section_id) {
      const grouped = {
        decorative: [],
        custome: [],
        background: [],
        image_icon: [],
        image_gif: [],
        special: [],
        season: [],
        sections: data
          .filter((s) => s.active !== false)
          .sort((a, b) => (a.order_id ?? 99) - (b.order_id ?? 99))
          .map((section) => ({
            id: section.section_id,
            name: section.name,
            badge: section.badge,
            items: (section.items || [])
              .map(normalizeOverlayItem)
              .filter(Boolean)
              .sort((a, b) => (a.order_index ?? 99) - (b.order_index ?? 99)),
          })),
      };

      for (const section of data) {
        if (section.active === false) continue;
        const key = SECTION_TO_GROUP[section.section_id] || "custome";
        const items = (section.items || [])
          .map(normalizeOverlayItem)
          .filter(Boolean);
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(...items);
      }

      // Sort each group
      for (const k of Object.keys(grouped)) {
        if (Array.isArray(grouped[k]) && k !== "sections") {
          grouped[k].sort(
            (a, b) => (a.order_index ?? 99) - (b.order_index ?? 99)
          );
        }
      }

      return grouped;
    }

    // Legacy flat list
    if (Array.isArray(data)) {
      return data.map(normalizeOverlayItem).filter(Boolean);
    }

    return data;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi overlays API:", error.message);
    return null;
  }
};
