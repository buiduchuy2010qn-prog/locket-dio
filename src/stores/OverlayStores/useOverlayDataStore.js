import { getAllOverlayCaptionV2 } from "@/services";
import { enrichOverlayItem } from "@/features/CustomeStudio/utils/overlayLabels";
import { create } from "zustand";

// v4: store RAW sections so time windows can re-open items without refetch
const CACHE_KEY = "overlaySections_v4_raw";
const OLD_CACHE_KEYS = [
  "overlaySections",
  "overlaySections_v2",
  "overlaySections_v3",
];

/** Re-filter interval — Caption Season / daily windows (ms) */
const REFILTER_MS = 60 * 1000;
/** Soft API refetch while realtime is on (ms) */
const REFETCH_MS = 3 * 60 * 1000;

/* Check overlay item có đang active theo thời gian thật */
const isOverlayActive = (item) => {
  if (!item) return false;
  if (item.active === false) return false;

  const now = new Date();

  if (item.start_at) {
    const t = new Date(item.start_at);
    if (!Number.isNaN(t.getTime()) && t > now) return false;
  }
  if (item.end_at) {
    const t = new Date(item.end_at);
    if (!Number.isNaN(t.getTime()) && t < now) return false;
  }

  if (item.daily_start_hour != null && item.daily_end_hour != null) {
    const hour = now.getHours() + now.getMinutes() / 60;
    const start = Number(item.daily_start_hour);
    const end = Number(item.daily_end_hour);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      // Overnight window e.g. 22 → 6
      if (start <= end) {
        if (hour < start || hour > end) return false;
      } else if (hour < start && hour > end) {
        return false;
      }
    }
  }

  return true;
};

const isSectionActive = (section) => {
  if (!section || section.active === false) return false;
  const now = new Date();
  if (section.start_at) {
    const t = new Date(section.start_at);
    if (!Number.isNaN(t.getTime()) && t > now) return false;
  }
  if (section.end_at) {
    const t = new Date(section.end_at);
    if (!Number.isNaN(t.getTime()) && t < now) return false;
  }
  return true;
};

function clearOldCaches() {
  try {
    for (const k of OLD_CACHE_KEYS) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** Parse API → raw sections (enrich only, NO time filter) */
function parseRawSections(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.data || raw.sections || [];
  if (!Array.isArray(list)) return [];

  return list.map((section) => ({
    ...section,
    items: (section.items || []).map(enrichOverlayItem),
  }));
}

/** Apply live time windows → UI list */
function filterSectionsForDisplay(rawSections = []) {
  if (!Array.isArray(rawSections)) return [];
  return rawSections
    .filter(isSectionActive)
    .map((section) => ({
      ...section,
      items: (section.items || []).filter(isOverlayActive),
    }))
    // Keep section even if empty? Hide empty seasonal sections to avoid blank rows.
    // Always keep known structural sections if needed later.
    .filter(
      (s) =>
        (s.items && s.items.length > 0) ||
        s.section_id === "saved_caption",
    );
}

let refilterTimer = null;
let refetchTimer = null;
let visibilityBound = false;

function bindVisibility(get) {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // Tab back: refilter immediately + soft refetch
      get().refilterNow?.();
      get().fetchCaptionOverlays?.(true, { silent: true });
    }
  });
}

export const useOverlayDataStore = create((set, get) => ({
  /** Filtered for UI (Caption Season, Suggest Caption, …) */
  sectionOverlays: [],
  /** Unfiltered — used for realtime re-open when window hits */
  rawSections: [],
  isLoading: false,
  error: null,
  lastFetchedAt: 0,
  lastRefilteredAt: 0,
  realtimeActive: false,

  /** Re-apply start_at / end_at / daily hours on cached raw list */
  refilterNow: () => {
    const raw = get().rawSections;
    if (!raw?.length) return;
    const filtered = filterSectionsForDisplay(raw);
    set({
      sectionOverlays: filtered,
      lastRefilteredAt: Date.now(),
    });
  },

  /**
   * Fetch overlays from API.
   * @param {boolean} force
   * @param {{ silent?: boolean }} [opts] silent = no loading spinner (poll)
   */
  fetchCaptionOverlays: async (force = false, opts = {}) => {
    const silent = Boolean(opts?.silent);

    // Soft poll: still allow if force; skip only when non-force + already have data
    if (!force && get().sectionOverlays.length > 0 && get().rawSections.length > 0) {
      // Still refilter clock windows even if we skip network
      get().refilterNow();
      return;
    }

    if (!silent) set({ isLoading: true, error: null });
    clearOldCaches();

    try {
      if (!force) {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const raw = parsed.map((section) => ({
                ...section,
                items: (section.items || []).map(enrichOverlayItem),
              }));
              const filtered = filterSectionsForDisplay(raw);
              set({
                rawSections: raw,
                sectionOverlays: filtered,
                isLoading: false,
                lastRefilteredAt: Date.now(),
              });
              // Background refresh
              getAllOverlayCaptionV2()
                .then((result) => {
                  const freshRaw = parseRawSections(result);
                  if (freshRaw.length) {
                    try {
                      sessionStorage.setItem(
                        CACHE_KEY,
                        JSON.stringify(freshRaw),
                      );
                    } catch {
                      /* quota */
                    }
                    set({
                      rawSections: freshRaw,
                      sectionOverlays: filterSectionsForDisplay(freshRaw),
                      lastFetchedAt: Date.now(),
                      lastRefilteredAt: Date.now(),
                      error: null,
                    });
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
      const raw = parseRawSections(result);
      const filtered = filterSectionsForDisplay(raw);

      if (raw.length) {
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(raw));
        } catch {
          /* quota */
        }
      }

      set({
        rawSections: raw,
        sectionOverlays: filtered,
        isLoading: false,
        lastFetchedAt: Date.now(),
        lastRefilteredAt: Date.now(),
        error: filtered.length || raw.length ? null : "empty",
      });
    } catch (err) {
      console.error("[overlays]", err);
      // Keep previous list on poll failure
      if (!get().sectionOverlays.length) {
        set({ error: err, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    }
  },

  /**
   * Start realtime: refilter every 60s + soft refetch every 3 min.
   * Safe to call multiple times (idempotent).
   */
  startRealtimeRefresh: () => {
    if (typeof window === "undefined") return;
    if (get().realtimeActive) return;

    set({ realtimeActive: true });
    bindVisibility(get);

    // Immediate refilter
    get().refilterNow();

    refilterTimer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      get().refilterNow();
    }, REFILTER_MS);

    refetchTimer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      get().fetchCaptionOverlays(true, { silent: true });
    }, REFETCH_MS);
  },

  stopRealtimeRefresh: () => {
    if (refilterTimer) {
      clearInterval(refilterTimer);
      refilterTimer = null;
    }
    if (refetchTimer) {
      clearInterval(refetchTimer);
      refetchTimer = null;
    }
    set({ realtimeActive: false });
  },
}));
