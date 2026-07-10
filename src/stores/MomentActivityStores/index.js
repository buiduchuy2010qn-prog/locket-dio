import { create } from "zustand";
import { GetReactionsMoment, GetViewsMoment } from "@/services";
import { getMomentById } from "@/cache/momentDB";
import {
  buildActivityFromViewsAndReactions,
  computePollCounts,
  resolvePollOverlay,
} from "@/utils/momentActivity";

const emptyEntry = () => ({
  activity: [],
  pollCounts: null,
  isPublic: true,
  ownerUid: null,
  isOwn: false,
  loading: false,
  error: null,
  fetchedAt: null,
});

export const resolveMyUid = (user) =>
  user?.localId ??
  user?.uid ??
  (typeof localStorage !== "undefined"
    ? localStorage.getItem("localId")
    : null);

export const resolveMomentOwnerUid = (moment) =>
  moment?.user ?? moment?.userUid ?? moment?.owner ?? null;

export const useMomentActivityStore = create((set, get) => ({
  byMomentId: {},
  activeMomentId: null,
  activeOwnerUid: null,
  fetchGeneration: {},

  isOwnMoment: (ownerUid, myUid) => {
    if (!ownerUid || !myUid) return false;
    return ownerUid === myUid;
  },

  clearActive: () => {
    set({ activeMomentId: null, activeOwnerUid: null });
  },

  getEntry: (momentId) => {
    if (!momentId) return emptyEntry();
    return get().byMomentId[momentId] ?? emptyEntry();
  },

  /**
   * Đồng bộ context moment đang chọn + chỉ fetch activity nếu là moment của bản thân.
   */
  syncForSelectedMoment: async ({ momentId, myUid, ownerUid: knownOwner }) => {
    if (!momentId || !myUid) {
      get().clearActive();
      return { isOwn: false };
    }

    set({ activeMomentId: momentId, activeOwnerUid: knownOwner ?? null });

    // Luôn đọc moment từ DB để lấy isPublic chính xác
    let ownerUid = knownOwner;
    let isPublic = true;

    try {
      const moment = await getMomentById(momentId);
      if (get().activeMomentId !== momentId) {
        return { isOwn: false, stale: true };
      }
      // Ưu tiên ownerUid đã biết sẵn, fallback sang DB
      ownerUid = knownOwner ?? resolveMomentOwnerUid(moment);
      isPublic = moment?.isPublic ?? true;
    } catch (err) {
      console.error("❌ syncForSelectedMoment - getMomentById:", err);
      if (!ownerUid) {
        // Không có ownerUid và không đọc được DB → báo lỗi
        set((state) => ({
          activeOwnerUid: null,
          byMomentId: {
            ...state.byMomentId,
            [momentId]: {
              ...emptyEntry(),
              loading: false,
              error: err?.message ?? "load_failed",
            },
          },
        }));
        return { isOwn: false, error: err };
      }
      // Có ownerUid rồi → tiếp tục với isPublic mặc định true
    }

    if (get().activeMomentId !== momentId) {
      return { isOwn: false, stale: true };
    }

    const isOwn = get().isOwnMoment(ownerUid, myUid);

    set((state) => ({
      activeOwnerUid: ownerUid,
      byMomentId: {
        ...state.byMomentId,
        [momentId]: {
          ...(state.byMomentId[momentId] ?? emptyEntry()),
          ownerUid,
          isPublic,
          isOwn,
          loading: false,
          error: null,
          ...(isOwn ? {} : { activity: [] }),
        },
      },
    }));

    if (!isOwn) {
      return { isOwn: false, ownerUid, isPublic };
    }

    // Post private → chỉ bản thân xem được, không có views/reactions từ người khác
    if (isPublic === false) {
      return { isOwn: true, ownerUid, isPublic };
    }

    await get().fetchActivityForMoment({ momentId, myUid, ownerUid });
    return { isOwn: true, ownerUid, isPublic };
  },

  fetchActivityForMoment: async ({ momentId, myUid, ownerUid }) => {
    if (!momentId || !myUid || !get().isOwnMoment(ownerUid, myUid)) {
      return;
    }

    // Guard: post private → skip, không gọi API
    const currentEntry = get().byMomentId[momentId];
    if (currentEntry?.isPublic === false) {
      return;
    }

    const nextGen = (get().fetchGeneration[momentId] ?? 0) + 1;

    set((state) => ({
      fetchGeneration: { ...state.fetchGeneration, [momentId]: nextGen },
      byMomentId: {
        ...state.byMomentId,
        [momentId]: {
          ...(state.byMomentId[momentId] ?? emptyEntry()),
          ownerUid,
          isOwn: true,
          loading: true,
          error: null,
        },
      },
    }));

    const isStale = () =>
      get().fetchGeneration[momentId] !== nextGen ||
      get().activeMomentId !== momentId;

    try {
      const [info, views] = await Promise.all([
        GetReactionsMoment(momentId),
        GetViewsMoment(momentId),
      ]);

      if (isStale()) return;

      const reactions = Array.isArray(info?.reactions) ? info.reactions : [];
      const merged = await buildActivityFromViewsAndReactions(views, reactions);
      if (isStale()) return;

      const moment = await getMomentById(momentId);
      if (isStale()) return;

      const pollOverlay = resolvePollOverlay(moment?.overlays);
      const pollCounts = pollOverlay
        ? computePollCounts(
            reactions,
            pollOverlay.leftEmoji,
            pollOverlay.rightEmoji,
          )
        : null;

      set((state) => ({
        byMomentId: {
          ...state.byMomentId,
          [momentId]: {
            ...(state.byMomentId[momentId] ?? emptyEntry()),
            ownerUid,
            isOwn: true,
            activity: merged,
            pollCounts,
            loading: false,
            error: null,
            fetchedAt: Date.now(),
          },
        },
      }));
    } catch (err) {
      console.error("❌ fetchActivityForMoment:", err);
      if (isStale()) return;

      set((state) => ({
        byMomentId: {
          ...state.byMomentId,
          [momentId]: {
            ...(state.byMomentId[momentId] ?? emptyEntry()),
            loading: false,
            error: err?.message ?? "fetch_failed",
          },
        },
      }));
    }
  },

  invalidateMoment: (momentId) => {
    if (!momentId) return;
    set((state) => {
      const next = { ...state.byMomentId };
      delete next[momentId];
      return { byMomentId: next };
    });
  },
}));
