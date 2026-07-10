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
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                moments: [...localData].sort(
                  (a, b) => b.createTime - a.createTime
                ),
              },
            },
          };
        });
      }

      /* ---------- API sync ---------- */
      const apiData = await GetAllMoments({
        timestamp: Math.floor(Date.now() / 1000),
        friendId: selectedFriendUid,
        limit: initialVisible,
      });

      if (apiData?.length) {
        set((state) => {
          const bucket = state.momentsByUser[key] ?? defaultBucket();
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                moments: [...apiData].sort((a, b) => b.createTime - a.createTime),
              },
            },
          };
        });

        // cache lại local
        await bulkAddMoments(apiData);
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
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                moments: [...localData].sort(
                  (a, b) => b.createTime - a.createTime
                ),
              },
            },
          };
        });
      }

      /* ---------- API sync ---------- */
      const apiData = await GetAllMoments({
        timestamp: Math.floor(Date.now() / 1000),
        friendId: selectedFriendUid,
        limit: initialVisible,
      });

      if (apiData?.length) {
        set((state) => {
          const bucket = state.momentsByUser[key] ?? defaultBucket();
          return {
            momentsByUser: {
              ...state.momentsByUser,
              [key]: {
                ...bucket,
                moments: [...apiData].sort((a, b) => b.createTime - a.createTime),
              },
            },
          };
        });

        // cache lại local
        await bulkAddMoments(apiData);
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

      for (const m of items) {
        if (!m?.id) continue;

        const ownerUid = m.userUid || m.user || m.owner;
        const keys = [ownerUid ?? "all", "all"]; // 👈 add vào feed + all

        for (const key of keys) {
          if (!key) continue;

          const bucket = next[key] ?? defaultBucket();

          // ❌ duplicate
          if (bucket.moments.some((i) => i.id === m.id)) continue;

          next[key] = {
            ...bucket,
            moments: [m, ...bucket.moments].sort(
              (a, b) => b.createTime - a.createTime
            ),
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
          byId.set(m.id, m);
          dbQueue.push(m);
        }

        next[key] = {
          ...bucket,
          moments: [...byId.values()].sort(
            (a, b) => b.createTime - a.createTime,
          ),
        };

        // Keep "all" feed in sync when filtering by friend
        if (key !== "all") {
          const all = next["all"] ?? defaultBucket();
          const allById = new Map(all.moments.map((m) => [m.id, m]));
          for (const m of apiData) {
            if (m?.id) allById.set(m.id, m);
          }
          next["all"] = {
            ...all,
            moments: [...allById.values()].sort(
              (a, b) => b.createTime - a.createTime,
            ),
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
