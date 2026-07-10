import { getAllOverlayCaptionV2 } from "@/services";
import { create } from "zustand";

const CACHE_KEY = "overlaySections_v2";

/* Check overlay có đang active không */
const isOverlayActive = (item) => {
  if (!item) return false;
  if (item.active === false) return false;

  const now = new Date();

  if (item.start_at && new Date(item.start_at) > now) return false;
  if (item.end_at && new Date(item.end_at) < now) return false;

  if (item.daily_start_hour != null && item.daily_end_hour != null) {
    const hour = now.getHours() + now.getMinutes() / 60;
    if (hour < item.daily_start_hour || hour > item.daily_end_hour) {
      return false;
    }
  }

  return true;
};

function normalizeSections(raw) {
  if (!raw) return [];
  // API có thể trả array hoặc { data: [] }
  const list = Array.isArray(raw) ? raw : raw.data || raw.sections || [];
  if (!Array.isArray(list)) return [];

  return list
    .map((section) => ({
      ...section,
      items: (section.items || []).filter(isOverlayActive),
    }))
    .filter((s) => s.active !== false);
}

export const useOverlayDataStore = create((set, get) => ({
  sectionOverlays: [],
  isLoading: false,
  error: null,

  fetchCaptionOverlays: async (force = false) => {
    if (!force && get().sectionOverlays.length > 0) return;

    set({ isLoading: true, error: null });

    try {
      if (!force) {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              set({ sectionOverlays: parsed, isLoading: false });
              // Refresh nền — không chặn UI
              getAllOverlayCaptionV2()
                .then((result) => {
                  const sections = normalizeSections(result);
                  if (sections.length) {
                    sessionStorage.setItem(CACHE_KEY, JSON.stringify(sections));
                    set({ sectionOverlays: sections });
                  }
                })
                .catch(() => {});
              return;
            }
          } catch {
            sessionStorage.removeItem(CACHE_KEY);
          }
        }
      }

      const result = await getAllOverlayCaptionV2();
      const sections = normalizeSections(result);

      if (sections.length) {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(sections));
      }

      set({
        sectionOverlays: sections,
        isLoading: false,
        error: sections.length ? null : "empty",
      });
    } catch (err) {
      console.error("[overlays]", err);
      set({ error: err, isLoading: false });
    }
  },
}));
