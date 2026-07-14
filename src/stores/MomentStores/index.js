import { create } from "zustand";
import { GetAllMoments } from "@/services";
import { MOMENTS_CONFIG } from "@/config/configAlias";
import {
  bulkAddMoments,
  deleteMomentById,
  getAllMoments,
  getMomentsByUser,
} from "@/cache/momentDB";

const { initialVisible, loadMoreLimit } = MOMENTS_CONFIG;

/* --------------------------------------------------
 * Default bucket
 * -------------------------------------------------- */
const defaultBucket = () => ({
  moments: [],
  loading: false,
  hasMore: true,
  isLoadingMore: false,
  visibleCount: initialVisible,
});

/** createTime luôn là ms number — tránh sort NaN làm bài "biến mất" */
function toCreateTimeMs(v) {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v > 0 && v < 1e12 ? v * 1000 : v;
  }
  if (typeof v === "string" && v.trim()) {
    const n = Date.parse(v);
    return Number.isNaN(n) ? 0 : n;
  }
  if (v && typeof v === "object") {
    if (typeof v._seconds === "number") return v._seconds * 1000;
    if (typeof v.seconds === "number") return v.seconds * 1000;
  }
  return 0;
}

function hasMusicOverlay(m) {
  const o = m?.overlays;
  if (!o) return false;
  if (o.type === "music" || o.overlay_id === "caption:music") return true;
  if (o.payload?.isrc || o.payload?.song_title) return true;
  const cap = Array.isArray(m?.captions) ? m.captions[0] : null;
  return Boolean(cap?.type === "music" || cap?.payload?.isrc);
}

/**
 * Merge moment: không xóa bài local; giữ overlay nhạc nếu API trả thiếu.
 * (pullLatest/fetch trước đây ghi đè → bài "Vừa xong" biến mất / mất nhạc)
 */
function mergeMoment(local, incoming) {
  if (!incoming && !local) return null;
  if (!incoming) {
    return {
      ...local,
      createTime: toCreateTimeMs(local.createTime) || Date.now(),
    };
  }
  if (!local) {
    return {
      ...incoming,
      createTime:
        toCreateTimeMs(incoming.createTime || incoming.date) || Date.now(),
    };
  }

  const createTime = Math.max(
    toCreateTimeMs(local.createTime || local.date),
    toCreateTimeMs(incoming.createTime || incoming.date),
    0,
  );

  const preferLocalMusic =
    hasMusicOverlay(local) && !hasMusicOverlay(incoming);

  return {
    ...local,
    ...incoming,
    createTime: createTime || Date.now(),
    overlays: preferLocalMusic
      ? local.overlays
      : incoming.overlays || local.overlays,
    captions: preferLocalMusic
      ? local.captions
      : incoming.captions || local.captions,
    image_url:
      incoming.image_url ||
      local.image_url ||
      incoming.thumbnail_url ||
      local.thumbnail_url ||
      null,
    thumbnail_url:
      incoming.thumbnail_url ||
      local.thumbnail_url ||
      incoming.image_url ||
      local.image_url ||
      null,
    video_url: incoming.video_url || local.video_url || null,
  };
}

function sortByCreateTimeDesc(list) {
  return [...list].sort(
    (a, b) =>
      toCreateTimeMs(b.createTime || b.date) -
      toCreateTimeMs(a.createTime || a.date),
  );
}

/* --------------------------------------------------
 * Store
 * -------------------------------------------------- */
export const useMomentsStoreV2 = create((set, get) => ({
  momentsByUser: {},

  /* --------------------------------------------------
   * 🔧 Ensure bucket (SAFE – no race condition)
   * -------------------------------------------------- */
  ensureBucket: (key) => {
    set((state) => {
      if (state.momentsByUser[key]) return state;
      return {
        momentsByUser: {
          ...state.momentsByUser,
          [key]: defaultBucket(),
        },
      };
    });
  },

  /* --------------------------------------------------
   * 1️⃣ Fetch initial (Local → API)
   * -------------------------------------------------- */
  fetchMoments: async (user, selectedFriendUid = null) => {
    if (!user) return;

    const key = selectedFriendUid ?? "all";
    get().ensureBucket(key);

    // loading = true
    set((state) => {
      const bucket = state.momentsByUser[key] ?? defaultBucket();
      return {
        momentsByUser: {
          ...state.momentsByUser,
          [key]: {
            ...bucket,
            loading: true,
            hasMore: true,
            visibleCount: initialVisible,
          },
        },
      };
    });

    try {
      /* ---------- Local DB ---------- */
      const localData = selectedFriendUid
        ? await getMomentsByUser(selectedFriendUid)
        : await getAllMoments();

      if (localData?.length) {
        set((state) => {
          const bucket = state.momentsByUser[key] ?? defaultBucket();
          // Giữ moment đang có trong RAM (vừa đăng) + local DB
          const byId = new Map(
            (bucket.moments || []).map((m) => [m.id, m]),
          );
          for (const m of localData) {
            if (!m?.id) continue;
            byId.set(m.id, mergeMoment(byId.get(m.id), m));
          }
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                moments: sortByCreateTimeDesc([...byId.values()]),
              },
            },
          };
        });
      }

      /* ---------- API sync — MERGE, không wipe feed ---------- */
      const apiData = await GetAllMoments({
        timestamp: Math.floor(Date.now() / 1000),
        friendId: selectedFriendUid,
        limit: initialVisible,
      });

      if (apiData?.length) {
        let mergedForCache = [];
        set((state) => {
          const bucket = state.momentsByUser[key] ?? defaultBucket();
          const byId = new Map(
            (bucket.moments || []).map((m) => [m.id, m]),
          );
          for (const m of apiData) {
            if (!m?.id) continue;
            byId.set(m.id, mergeMoment(byId.get(m.id), m));
          }
          mergedForCache = sortByCreateTimeDesc([...byId.values()]);
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                moments: mergedForCache,
              },
            },
          };
        });

        // Cache bản đã merge (giữ nhạc) — không ghi đè bằng API thiếu overlay
        if (mergedForCache.length) {
          await bulkAddMoments(mergedForCache);
        }
      }
    } catch (err) {
      console.error("❌ fetchMoments error:", err);
    } finally {
      set((state) => {
        const bucket = state.momentsByUser[key];
        if (!bucket) return state;
        return {
          momentsByUser: {
            ...state.momentsByUser,
            [key]: {
              ...bucket,
              loading: false,
            },
          },
        };
      });
    }
  },

  reloadMoments: async (selectedFriendUid = null) => {
    // Cùng logic merge với fetchMoments (user truthy để không early-return)
    return get().fetchMoments({ reload: true }, selectedFriendUid);
  },

  /* --------------------------------------------------
   * 2️⃣ Load more older
   * -------------------------------------------------- */
  loadMoreOlder: async (selectedFriendUid = null) => {
    const key = selectedFriendUid ?? "all";
    const bucket = get().momentsByUser[key];
    if (!bucket) return;

    if (bucket.isLoadingMore || !bucket.hasMore || !bucket.moments.length) {
      return;
    }

    // set loading more
    set((state) => {
      const b = state.momentsByUser[key];
      if (!b) return state;
      return {
        momentsByUser: {
          ...state.momentsByUser,
          [key]: {
            ...b,
            isLoadingMore: true,
          },
        },
      };
    });

    try {
      const lastCreateTime = bucket.moments[bucket.moments.length - 1].createTime;

      const older = await GetAllMoments({
        timestamp: lastCreateTime,
        friendId: selectedFriendUid,
        limit: loadMoreLimit,
      });

      if (!older?.length) {
        set((state) => {
          const b = state.momentsByUser[key];
          if (!b) return state;
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...b,
                hasMore: false,
              },
            },
          };
        });
        return;
      }

      set((state) => {
        const b = state.momentsByUser[key];
        if (!b) return state;

        const existingIds = new Set(b.moments.map((i) => i.id));
        const filtered = older.filter((m) => !existingIds.has(m.id));

        return {
          momentsByUser: {
            ...state.momentsByUser,
            [key]: {
              ...b,
              moments: [...b.moments, ...filtered],
              hasMore: older.length === loadMoreLimit,
            },
          },
        };
      });

      await bulkAddMoments(older);
    } catch (err) {
      console.error("❌ loadMoreOlder error:", err);
    } finally {
      set((state) => {
        const b = state.momentsByUser[key];
        if (!b) return state;
        return {
          momentsByUser: {
            ...state.momentsByUser,
            [key]: {
              ...b,
              isLoadingMore: false,
            },
          },
        };
      });
    }
  },

  /* --------------------------------------------------
   * 3️⃣ Realtime add moment (Socket)
   * -------------------------------------------------- */
  addNewMoment: async (payload) => {
    const items = Array.isArray(payload) ? payload : [payload];
    if (!items.length) return;

    const dbQueue = [];

    set((state) => {
      const next = { ...state.momentsByUser };

      for (const raw of items) {
        if (!raw?.id) continue;
        const m = {
          ...raw,
          createTime:
            toCreateTimeMs(raw.createTime || raw.date) || Date.now(),
        };

        const ownerUid = m.userUid || m.user || m.owner;
        const keys = [ownerUid ?? "all", "all"];

        for (const key of keys) {
          if (!key) continue;

          const bucket = next[key] ?? defaultBucket();
          const existing = bucket.moments.find((i) => i.id === m.id);
          const merged = mergeMoment(existing, m);
          const rest = bucket.moments.filter((i) => i.id !== m.id);

          next[key] = {
            ...bucket,
            moments: sortByCreateTimeDesc([merged, ...rest]),
          };
        }

        dbQueue.push(m);
      }

      return { momentsByUser: next };
    });

    if (dbQueue.length) {
      await bulkAddMoments(dbQueue);
    }
  },

  /**
   * Merge a partial snapshot from socket / poll into the feed.
   * IMPORTANT: do NOT wipe moments missing from the list — server often
   * only sends the latest N items (limit=5). Old code filtered the feed
   * down to snapshot ids → empty UI after realtime push.
   */
  syncMomentsSnapshot: async (snapshot) => {
    if (!Array.isArray(snapshot) || !snapshot.length) return;
    // Same path as realtime single/batch add (dedupe + sort + cache)
    await get().addNewMoment(snapshot);
  },

  /**
   * Soft pull latest moments without full-screen loading state.
   * Used for auto-refresh (tab focus, open history, interval).
   */
  pullLatestMoments: async (selectedFriendUid = null) => {
    const key = selectedFriendUid ?? "all";
    get().ensureBucket(key);

    try {
      const apiData = await GetAllMoments({
        timestamp: Math.floor(Date.now() / 1000),
        friendId: selectedFriendUid,
        limit: initialVisible,
      });

      if (!apiData?.length) return;

      const dbQueue = [];

      set((state) => {
        const next = { ...state.momentsByUser };
        const bucket = next[key] ?? defaultBucket();
        const byId = new Map(bucket.moments.map((m) => [m.id, m]));

        for (const m of apiData) {
          if (!m?.id) continue;
          // MERGE — giữ overlay nhạc local nếu API cắt
          const merged = mergeMoment(byId.get(m.id), m);
          byId.set(m.id, merged);
          dbQueue.push(merged);
        }

        next[key] = {
          ...bucket,
          moments: sortByCreateTimeDesc([...byId.values()]),
        };

        // Keep "all" feed in sync when filtering by friend
        if (key !== "all") {
          const all = next["all"] ?? defaultBucket();
          const allById = new Map(all.moments.map((m) => [m.id, m]));
          for (const m of apiData) {
            if (!m?.id) continue;
            allById.set(m.id, mergeMoment(allById.get(m.id), m));
          }
          next["all"] = {
            ...all,
            moments: sortByCreateTimeDesc([...allById.values()]),
          };
        }

        return { momentsByUser: next };
      });

      if (dbQueue.length) {
        await bulkAddMoments(dbQueue);
      }
    } catch (err) {
      console.error("❌ pullLatestMoments error:", err);
    }
  },

  /* --------------------------------------------------
   * 4️⃣ Remove moment
   * -------------------------------------------------- */
  removeMoment: async (momentId, ownerUid = null) => {
    const key = ownerUid ?? "all";
    const bucket = get().momentsByUser[key];
    if (!bucket) return;

    set((state) => ({
      momentsByUser: {
        ...state.momentsByUser,
        [key]: {
          ...bucket,
          moments: bucket.moments.filter((m) => m.id !== momentId),
        },
      },
    }));

    await deleteMomentById(momentId);
  },

  /* --------------------------------------------------
   * 5️⃣ Visible count
   * -------------------------------------------------- */
  increaseVisibleCount: (selectedFriendUid = null) => {
    const key = selectedFriendUid ?? "all";
    const bucket = get().momentsByUser[key];
    if (!bucket) return;

    if (bucket.visibleCount < bucket.moments.length) {
      set((state) => ({
        momentsByUser: {
          ...state.momentsByUser,
          [key]: {
            ...bucket,
            visibleCount: Math.min(
              bucket.visibleCount + initialVisible,
              bucket.moments.length
            ),
          },
        },
      }));
    }
  },

  resetVisible: (selectedFriendUid = null) => {
    const key = selectedFriendUid ?? "all";
    const bucket = get().momentsByUser[key];
    if (!bucket) return;

    set((state) => ({
      momentsByUser: {
        ...state.momentsByUser,
        [key]: {
          ...bucket,
          visibleCount: initialVisible,
        },
      },
    }));
  },
}));
