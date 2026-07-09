import { useEffect, useState } from "react";
import {
  FALLBACK_CAPTION_PRESETS,
  getAllOverlayCaption,
} from "@/services";

const emptyGroups = () => ({
  decorative: [],
  custome: [],
  background: [],
  image_icon: [],
  image_gif: [],
  special: [],
  season: [],
  sections: [],
});

const CACHE_KEY = "captionThemes_v2";

export const useThemes = () => {
  const [captionThemes, setCaptionThemes] = useState(emptyGroups);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Drop legacy empty cache from dead /themes endpoint
    try {
      sessionStorage.removeItem("captionThemes");
    } catch (_) {
      /* ignore */
    }

    const fetchThemes = async () => {
      setLoading(true);

      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (
            parsed?.background?.length ||
            parsed?.decorative?.length ||
            parsed?.custome?.length ||
            parsed?.special?.length
          ) {
            setCaptionThemes({ ...emptyGroups(), ...parsed });
            setLoading(false);
            // still refresh in background
          }
        }
      } catch (_) {
        /* ignore bad cache */
      }

      try {
        const result = await getAllOverlayCaption();

        if (result && !Array.isArray(result) && (result.background || result.sections)) {
          const next = { ...emptyGroups(), ...result };
          setCaptionThemes(next);
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } else if (Array.isArray(result) && result.length) {
          // legacy flat array — keep old grouping by type
          const grouped = {
            ...emptyGroups(),
            decorative: result.filter((t) => t.type === "decorative"),
            custome: result.filter(
              (t) => t.type === "custome" || t.type === "template"
            ),
            background: result.filter(
              (t) => t.type === "background" || t.type === "custom"
            ),
            special: result.filter(
              (t) => t.type === "special" || t.type === "star_sign"
            ),
          };
          setCaptionThemes(grouped);
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(grouped));
        } else {
          // API empty/fail → fallback presets so studio still works
          console.warn("Using fallback caption presets");
          setCaptionThemes({ ...emptyGroups(), ...FALLBACK_CAPTION_PRESETS });
        }
      } catch (error) {
        console.error("Lỗi khi fetch themes:", error);
        setCaptionThemes({ ...emptyGroups(), ...FALLBACK_CAPTION_PRESETS });
      } finally {
        setLoading(false);
      }
    };

    fetchThemes();
  }, []);

  return { captionThemes, loading };
};
