import { create } from "zustand";
import {
  createDraft,
  updateDraftMedia,
  updateDraftMeta,
  listDraftsMeta,
  getDraftFull,
  getDraftMeta,
  deleteDraft,
  resetStuckPostingDrafts,
  draftMediaToFile,
  collectMetaFromStores,
  resolveDraftUid,
  requestDraftPersist,
  formatDraftSavedAt,
  DRAFT_STATUS,
  isRestoreInProgress,
  setRestoreInProgress,
  statusLabel,
} from "@/utils/momentDraft";
import { usePostStore } from "./usePostStore";
import { useOverlayEditorStore } from "./useOverlayEditorStore";
import {
  SonnerError,
  SonnerInfo,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/uikit/SonnerToast";
import * as services from "@/services";
import { useUploadQueueStore } from "./useUploadPostStore";
import { useConnectivityStore } from "@/stores/useConnectivityStore";
import { resetAllPostData } from "@/utils";

let metaSaveTimer = null;
let mediaSaveChain = Promise.resolve();

function snapshotMetaFromStores() {
  const post = usePostStore.getState();
  const overlay = useOverlayEditorStore.getState().overlayData;
  return collectMetaFromStores({
    overlayData: overlay,
    audience: post.audience,
    selectedRecipients: post.selectedRecipients,
    selectedGroupId: post.selectedGroupId,
    videoCropData: post.videoCropData,
    restoreStreakData: post.restoreStreakData,
  });
}

function applyMetaToStores(meta) {
  const ov = meta.overlays || meta.optionsData || {};
  useOverlayEditorStore.getState().updateOverlayEditor({
    overlay_id: ov.overlay_id || meta.captionStyle?.overlay_id || "standard",
    text: ov.text || meta.caption || "",
    caption: ov.caption || meta.caption || "",
    text_color: ov.text_color || meta.captionStyle?.text_color || "#FFFFFF",
    icon: ov.icon || meta.captionStyle?.icon || {},
    type: ov.type || meta.captionStyle?.type || "default",
    background: ov.background || meta.captionStyle?.background || { colors: [] },
    payload: ov.payload || meta.music || {},
    color_top: ov.color_top || meta.captionStyle?.color_top || "",
    color_bottom: ov.color_bottom || meta.captionStyle?.color_bottom || "",
  });
  const friendIds = Array.isArray(meta.selectedFriendIds)
    ? meta.selectedFriendIds
    : [];
  usePostStore.getState().setAudience(meta.audience || "all");
  usePostStore.getState().setSelectedRecipients(friendIds);
  if (meta.optionsData?.selectedGroupId) {
    usePostStore.getState().setSelectedGroupId(meta.optionsData.selectedGroupId);
  }
  if (meta.optionsData?.videoCropData) {
    usePostStore.getState().setVideoCropData(meta.optionsData.videoCropData);
  }
  if (meta.optionsData?.restoreStreakData) {
    usePostStore
      .getState()
      .setRestoreStreakData(meta.optionsData.restoreStreakData);
  }
}

export const useMomentDraftStore = create((set, get) => ({
  /** metadata rows only */
  drafts: [],
  draftCount: 0,
  /** currently editing draft UUID (null = unsaved studio session) */
  activeDraftId: null,
  /** library sheet open */
  libraryOpen: false,
  libraryFilter: "all", // all | image | video | failed
  /** single-draft UI compat */
  draftMeta: null,
  hasDraft: false,
  showRestoreModal: false,
  dismissedRestore: false,
  showReplacePrompt: false,
  pendingNewFile: null,
  loading: false,
  thumbnailUrl: null,
  /** global post lock — one draft at a time */
  postingDraftId: null,

  openLibrary: () => set({ libraryOpen: true }),
  closeLibrary: () => set({ libraryOpen: false }),
  setLibraryFilter: (f) => set({ libraryFilter: f || "all" }),

  clearThumbnail: () => {
    const url = get().thumbnailUrl;
    if (url?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    set({ thumbnailUrl: null });
  },

  refreshList: async (uid) => {
    const id = uid || resolveDraftUid();
    if (!id) {
      set({ drafts: [], draftCount: 0, hasDraft: false, draftMeta: null });
      return [];
    }
    const rows = await listDraftsMeta(id);
    set({
      drafts: rows,
      draftCount: rows.length,
      hasDraft: rows.length > 0,
      draftMeta: rows[0] || null,
    });
    return rows;
  },

  refreshDraftPresence: async (uid) => {
    const rows = await get().refreshList(uid);
    return rows.length > 0;
  },

  /**
   * After login: reset stuck posting, load list, offer restore if any drafts.
   */
  checkAndOfferRestore: async (user) => {
    const uid = resolveDraftUid(user);
    if (!uid) return;
    set({ loading: true });
    try {
      await requestDraftPersist();
      await resetStuckPostingDrafts(uid);
      const rows = await get().refreshList(uid);
      if (!rows.length) {
        set({
          showRestoreModal: false,
          loading: false,
          hasDraft: false,
          draftMeta: null,
        });
        get().clearThumbnail();
        return;
      }
      // Multi-draft: open library prompt once (not force modal every time if dismissed)
      set({
        hasDraft: true,
        draftMeta: rows[0],
        showRestoreModal: !get().dismissedRestore && rows.length === 1,
        loading: false,
      });
      if (rows.length > 1 && !get().dismissedRestore) {
        // Prefer library for multiple drafts
        set({ showRestoreModal: false, libraryOpen: true });
      }
    } catch (e) {
      console.error("[moment-draft] check restore", e);
      set({ loading: false });
    }
  },

  openRestoreModal: async () => {
    set({ dismissedRestore: false });
    await get().refreshList();
    const n = get().draftCount;
    if (n > 1) {
      set({ libraryOpen: true, showRestoreModal: false });
    } else if (n === 1) {
      set({ showRestoreModal: true, libraryOpen: false });
    } else {
      set({ libraryOpen: true });
    }
  },

  closeRestoreModal: () => set({ showRestoreModal: false }),
  dismissRestoreForLater: () =>
    set({ showRestoreModal: false, dismissedRestore: true }),
  setDismissedRestore: (v) => set({ dismissedRestore: Boolean(v) }),

  /**
   * Save current studio media as NEW draft (always new UUID) or update activeDraftId.
   * @param {{ asNew?: boolean, keepStudio?: boolean, clearAfter?: boolean }} opts
   */
  saveCurrentAsDraft: async (opts = {}) => {
    const { asNew = false, clearAfter = false } = opts;
    const uid = resolveDraftUid();
    if (!uid) {
      SonnerError("Chưa đăng nhập — không lưu được bản nháp.");
      return { error: "no-uid" };
    }
    let file = usePostStore.getState().selectedFile;
    const preview = usePostStore.getState().preview;
    if (!file && preview?.data?.startsWith("data:")) {
      try {
        const res = await fetch(preview.data);
        const blob = await res.blob();
        file = new File([blob], "locket_draft.jpg", {
          type: blob.type || "image/jpeg",
        });
        usePostStore.getState().setMediaFromFile(file);
      } catch {
        /* ignore */
      }
    }
    if (!file) {
      SonnerWarning("Chưa có ảnh/video để lưu bản nháp.");
      return { error: "no-file" };
    }

    const meta = snapshotMetaFromStores();
    const activeId = get().activeDraftId;

    mediaSaveChain = mediaSaveChain.then(async () => {
      let result;
      if (activeId && !asNew) {
        result = await updateDraftMedia(activeId, file, {
          ...meta,
          status: DRAFT_STATUS.READY,
        });
        if (!result.error) {
          await updateDraftMeta(activeId, {
            ...meta,
            status: DRAFT_STATUS.READY,
          });
          result = { id: activeId, ok: true };
        }
      } else {
        result = await createDraft({
          ownerUid: uid,
          file,
          meta: { ...meta, status: DRAFT_STATUS.READY },
        });
        if (result.id) {
          set({ activeDraftId: result.id });
        }
      }

      if (result.error === "quota" || result.error === "too-large") {
        SonnerError(
          result.message ||
            "Thiết bị không đủ dung lượng để lưu bản nháp này",
        );
      } else if (result.error) {
        SonnerError(result.message || "Không lưu được bản nháp.");
      } else {
        SonnerSuccess("Đã lưu bản nháp");
        await get().refreshList(uid);
        if (clearAfter) {
          get().clearStudioAfterSave();
        }
      }
      return result;
    });
    return mediaSaveChain;
  },

  clearStudioAfterSave: () => {
    usePostStore.getState().resetMedia?.();
    try {
      resetAllPostData();
    } catch {
      /* optional */
    }
    set({ activeDraftId: null });
  },

  /** Auto-bind media after capture: update active or create new draft (never overwrite others). */
  saveMediaFromFile: async (file) => {
    if (!file || isRestoreInProgress()) return { skipped: true };
    const uid = resolveDraftUid();
    if (!uid) return { error: "no-uid" };

    mediaSaveChain = mediaSaveChain.then(async () => {
      const meta = snapshotMetaFromStores();
      const activeId = get().activeDraftId;
      let result;
      if (activeId) {
        result = await updateDraftMedia(activeId, file, {
          ...meta,
          status: DRAFT_STATUS.READY,
        });
      } else {
        result = await createDraft({
          ownerUid: uid,
          file,
          meta: { ...meta, status: DRAFT_STATUS.READY },
        });
        if (result.id) set({ activeDraftId: result.id });
      }
      if (result.error === "quota" || result.error === "too-large") {
        SonnerError(
          result.message ||
            "Thiết bị không đủ dung lượng để lưu bản nháp này",
        );
      } else if (result.id || result.ok) {
        await get().refreshList(uid);
      }
      return result;
    });
    return mediaSaveChain;
  },

  scheduleMetaSave: (delayMs = 250) => {
    if (isRestoreInProgress()) return;
    if (!get().activeDraftId) return;
    if (metaSaveTimer) clearTimeout(metaSaveTimer);
    metaSaveTimer = setTimeout(() => {
      metaSaveTimer = null;
      void get().flushMetaSave();
    }, delayMs);
  },

  flushMetaSave: async () => {
    if (isRestoreInProgress()) return;
    const draftId = get().activeDraftId;
    if (!draftId) return;
    if (metaSaveTimer) {
      clearTimeout(metaSaveTimer);
      metaSaveTimer = null;
    }
    const post = usePostStore.getState();
    if (!post.selectedFile && !post.preview) return;
    const meta = snapshotMetaFromStores();
    await updateDraftMeta(draftId, {
      ...meta,
      status: DRAFT_STATUS.READY,
    });
    await get().refreshList();
  },

  restoreDraftIntoStudio: async (draftId) => {
    const uid = resolveDraftUid();
    if (!uid) {
      SonnerError("Chưa đăng nhập — không khôi phục được bản nháp.");
      return false;
    }
    const id = draftId || get().drafts[0]?.id;
    if (!id) return false;
    set({ loading: true });
    setRestoreInProgress(true);
    try {
      const loaded = await getDraftFull(id);
      if (!loaded?.meta || loaded.corrupt || !loaded.media) {
        SonnerError("Bản nháp bị hỏng hoặc không đọc được.");
        set({ loading: false });
        setRestoreInProgress(false);
        return false;
      }
      const file = draftMediaToFile(loaded.media, loaded.meta);
      if (!file) {
        SonnerError("Không tạo được file từ bản nháp.");
        set({ loading: false });
        setRestoreInProgress(false);
        return false;
      }
      usePostStore.getState().setMediaFromFile(file);
      applyMetaToStores(loaded.meta);
      set({
        activeDraftId: id,
        showRestoreModal: false,
        libraryOpen: false,
        dismissedRestore: false,
        hasDraft: true,
        draftMeta: loaded.meta,
        loading: false,
      });
      SonnerInfo("Đã mở bản nháp");
      return true;
    } catch (e) {
      console.error("[moment-draft] restore", e);
      SonnerError("Khôi phục bản nháp thất bại", e?.message || "");
      set({ loading: false });
      return false;
    } finally {
      setTimeout(() => setRestoreInProgress(false), 400);
    }
  },

  /**
   * Post a draft by id using existing createRequestPayloadV6 + upload queue.
   * One draft at a time. Delete only on API success.
   */
  postDraftById: async (draftId) => {
    if (!draftId) return false;
    if (get().postingDraftId) {
      SonnerWarning("Đang đăng một bản nháp khác — vui lòng chờ.");
      return false;
    }

    // Connectivity (health, not only navigator.onLine)
    try {
      const conn = await useConnectivityStore
        .getState()
        .checkConnectivity({ force: true });
      if (!conn?.browserOnline || !conn?.serverReachable) {
        SonnerWarning(
          "Đang ngoại tuyến",
          "Bản nháp vẫn được giữ. Thử đăng khi có mạng.",
        );
        await updateDraftMeta(draftId, {
          status: DRAFT_STATUS.FAILED,
          lastError: "Offline",
        });
        await get().refreshList();
        return false;
      }
    } catch {
      SonnerWarning("Không kết nối được máy chủ");
      return false;
    }

    set({ postingDraftId: draftId });
    await updateDraftMeta(draftId, {
      status: DRAFT_STATUS.POSTING,
      lastError: null,
    });
    await get().refreshList();

    // Preserve current studio (if any) then load draft
    const prevActive = get().activeDraftId;
    const prevFile = usePostStore.getState().selectedFile;

    setRestoreInProgress(true);
    try {
      const loaded = await getDraftFull(draftId);
      if (!loaded?.meta || loaded.corrupt || !loaded.media) {
        throw new Error("Bản nháp không đọc được");
      }
      const file = draftMediaToFile(loaded.media, loaded.meta);
      if (!file) throw new Error("Media trống");

      usePostStore.getState().setMediaFromFile(file);
      applyMetaToStores(loaded.meta);
      set({ activeDraftId: draftId });

      const payload = await services.createRequestPayloadV6();
      if (!payload) throw new Error("Không tạo được payload");

      // Tag queue item with draftId for success cleanup
      payload.draftId = draftId;
      await useUploadQueueStore.getState().enqueueUploadItem(payload);

      SonnerSuccess("Đã thêm vào hàng đợi đăng");
      // Clear studio after enqueue (upload runs async); draft stays until success
      try {
        usePostStore.getState().resetMedia?.();
        resetAllPostData();
      } catch {
        /* ignore */
      }
      set({ activeDraftId: null, libraryOpen: get().libraryOpen });
      return true;
    } catch (e) {
      console.error("[moment-draft] post failed", e);
      const attempts =
        ((await getDraftMeta(draftId))?.uploadAttempts || 0) + 1;
      await updateDraftMeta(draftId, {
        status: DRAFT_STATUS.FAILED,
        lastError: e?.message || "Đăng thất bại",
        uploadAttempts: attempts,
      });
      await get().refreshList();
      SonnerError("Đăng bản nháp thất bại", e?.message || "");
      // restore previous studio if any
      if (prevFile && prevActive) {
        set({ activeDraftId: prevActive });
      }
      return false;
    } finally {
      setRestoreInProgress(false);
      set({ postingDraftId: null });
    }
  },

  markPosting: async (draftId) => {
    const id = draftId || get().activeDraftId;
    if (!id) return;
    await updateDraftMeta(id, { status: DRAFT_STATUS.POSTING });
    await get().refreshList();
  },

  markEditing: async (draftId) => {
    const id = draftId || get().activeDraftId;
    if (!id) return;
    await updateDraftMeta(id, {
      status: DRAFT_STATUS.FAILED,
      lastError: "Đăng chưa thành công — thử lại.",
    });
    await get().refreshList();
  },

  clearAfterSuccessfulPost: async (draftId) => {
    const id = draftId || get().activeDraftId;
    if (id) {
      await deleteDraft(id);
    }
    if (get().activeDraftId === id) set({ activeDraftId: null });
    get().clearThumbnail();
    await get().refreshList();
    set({
      showRestoreModal: false,
      dismissedRestore: false,
    });
  },

  /** Permanent delete with caller confirmation already done */
  confirmDeleteDraft: async (draftId) => {
    const id = draftId || get().drafts[0]?.id;
    if (!id) return false;
    const ok = await deleteDraft(id);
    if (!ok) {
      SonnerError("Không thể xóa bản nháp.");
      return false;
    }
    if (get().activeDraftId === id) {
      set({ activeDraftId: null });
      try {
        usePostStore.getState().resetMedia?.();
        resetAllPostData();
      } catch {
        /* ignore */
      }
    }
    await get().refreshList();
    SonnerSuccess("Đã xóa bản nháp");
    return true;
  },

  softDeleteDraft: async (draftId) => get().confirmDeleteDraft(draftId),

  // Replace-prompt: new capture while studio empty but drafts exist → open library
  requestReplaceOrContinue: async () => true,

  applyNewMediaFile: async (file, { onApplied } = {}) => {
    if (!file) return false;
    // New capture session: clear active draft so createDraft gets new UUID
    // only if studio already empty; if editing a draft, keep id (update media)
    const studioEmpty =
      !usePostStore.getState().selectedFile &&
      !usePostStore.getState().preview?.data;
    if (studioEmpty) {
      set({ activeDraftId: null });
    }
    usePostStore.getState().setMediaFromFile(file);
    onApplied?.(file);
    return true;
  },

  cancelReplacePrompt: () =>
    set({ showReplacePrompt: false, pendingNewFile: null }),
  acceptReplaceWithNew: async () => {
    const file = get().pendingNewFile;
    set({ showReplacePrompt: false, pendingNewFile: null, activeDraftId: null });
    if (file) {
      usePostStore.getState().setMediaFromFile(file);
      await get().saveMediaFromFile(file);
    }
    return true;
  },
  continueOldDraftFromPrompt: async () => {
    set({ showReplacePrompt: false, pendingNewFile: null });
    await get().restoreDraftIntoStudio();
  },

  formatSavedAt: (ts) => formatDraftSavedAt(ts),
  statusLabel,
}));
