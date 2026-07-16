import { create } from "zustand";
import {
  deleteMomentDraft,
  getMomentDraftMeta,
  hasMomentDraft,
  loadMomentDraft,
  resolveDraftUid,
  saveMomentDraftMedia,
  setMomentDraftStatus,
  updateMomentDraftMeta,
  collectDraftMetaFromStores,
  draftMediaToFile,
  isRestoreInProgress,
  setRestoreInProgress,
  formatDraftSavedAt,
} from "@/utils/momentDraft";
import { usePostStore } from "./usePostStore";
import { useOverlayEditorStore } from "./useOverlayEditorStore";
import { SonnerError, SonnerInfo, SonnerSuccess } from "@/components/uikit/SonnerToast";

let metaSaveTimer = null;
let mediaSaveChain = Promise.resolve();

export const useMomentDraftStore = create((set, get) => ({
  /** meta without blob */
  draftMeta: null,
  hasDraft: false,
  /** restore modal open */
  showRestoreModal: false,
  /** user chose "Để sau" this session */
  dismissedRestore: false,
  /** replace-draft confirm while capturing new media */
  showReplacePrompt: false,
  pendingNewFile: null,
  loading: false,
  thumbnailUrl: null,

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

  setDismissedRestore: (v) => set({ dismissedRestore: Boolean(v) }),

  refreshDraftPresence: async (uid) => {
    const id = uid || resolveDraftUid();
    if (!id) {
      set({ hasDraft: false, draftMeta: null });
      return false;
    }
    try {
      const meta = await getMomentDraftMeta(id);
      const ok = Boolean(meta?.mediaKey);
      set({ hasDraft: ok, draftMeta: meta || null });
      return ok;
    } catch {
      set({ hasDraft: false, draftMeta: null });
      return false;
    }
  },

  /**
   * After login: load draft for this uid and offer restore modal.
   */
  checkAndOfferRestore: async (user) => {
    const uid = resolveDraftUid(user);
    if (!uid) return;
    set({ loading: true });
    try {
      const loaded = await loadMomentDraft(uid);
      if (!loaded?.meta?.mediaKey) {
        set({
          hasDraft: false,
          draftMeta: null,
          showRestoreModal: false,
          loading: false,
        });
        get().clearThumbnail();
        return;
      }
      if (loaded.corrupt || !loaded.media) {
        set({
          hasDraft: true,
          draftMeta: loaded.meta,
          showRestoreModal: true,
          loading: false,
        });
        return;
      }
      get().clearThumbnail();
      const thumb = URL.createObjectURL(loaded.media.blob);
      set({
        hasDraft: true,
        draftMeta: loaded.meta,
        thumbnailUrl: thumb,
        showRestoreModal: !get().dismissedRestore,
        loading: false,
      });
    } catch (e) {
      console.error("[moment-draft] check restore", e);
      set({ loading: false });
    }
  },

  openRestoreModal: async () => {
    const uid = resolveDraftUid();
    if (!uid) return;
    set({ dismissedRestore: false, loading: true });
    await get().checkAndOfferRestore();
    set({ showRestoreModal: true, loading: false });
  },

  closeRestoreModal: () => set({ showRestoreModal: false }),

  dismissRestoreForLater: () =>
    set({ showRestoreModal: false, dismissedRestore: true }),

  /**
   * Save media Blob after capture/pick. Single write of media.
   */
  saveMediaFromFile: async (file) => {
    if (!file || isRestoreInProgress()) return { skipped: true };
    const uid = resolveDraftUid();
    if (!uid) return { error: "no-uid" };

    mediaSaveChain = mediaSaveChain.then(async () => {
      const post = usePostStore.getState();
      const overlay = useOverlayEditorStore.getState().overlayData;
      const metaPatch = collectDraftMetaFromStores({
        overlayData: overlay,
        audience: post.audience,
        selectedRecipients: post.selectedRecipients,
        selectedGroupId: post.selectedGroupId,
        videoCropData: post.videoCropData,
        restoreStreakData: post.restoreStreakData,
      });
      const result = await saveMomentDraftMedia(uid, file, metaPatch);
      if (result.error === "quota" || result.error === "too-large") {
        SonnerError(
          result.message ||
            "Thiết bị không còn đủ dung lượng để lưu bản nháp này.",
        );
      } else if (result.mediaKey) {
        await get().refreshDraftPresence(uid);
      } else if (result.error) {
        console.warn("[moment-draft] media save:", result.error, result.message);
      }
      return result;
    });
    return mediaSaveChain;
  },

  /**
   * Debounced metadata flush (caption / music / audience).
   */
  scheduleMetaSave: (delayMs = 250) => {
    if (isRestoreInProgress()) return;
    const uid = resolveDraftUid();
    if (!uid) return;
    if (metaSaveTimer) clearTimeout(metaSaveTimer);
    metaSaveTimer = setTimeout(() => {
      metaSaveTimer = null;
      void get().flushMetaSave();
    }, delayMs);
  },

  flushMetaSave: async () => {
    if (isRestoreInProgress()) return;
    const uid = resolveDraftUid();
    if (!uid) return;
    if (metaSaveTimer) {
      clearTimeout(metaSaveTimer);
      metaSaveTimer = null;
    }
    const exists = await hasMomentDraft(uid);
    if (!exists) return;
    const post = usePostStore.getState();
    if (!post.selectedFile && !post.preview) {
      // Studio cleared but draft may still exist (dismissed) — only update if posting flag
      return;
    }
    const overlay = useOverlayEditorStore.getState().overlayData;
    const patch = collectDraftMetaFromStores({
      overlayData: overlay,
      audience: post.audience,
      selectedRecipients: post.selectedRecipients,
      selectedGroupId: post.selectedGroupId,
      videoCropData: post.videoCropData,
      restoreStreakData: post.restoreStreakData,
    });
    await updateMomentDraftMeta(uid, patch);
    await get().refreshDraftPresence(uid);
  },

  /**
   * Apply draft into post + overlay stores.
   */
  restoreDraftIntoStudio: async () => {
    const uid = resolveDraftUid();
    if (!uid) {
      SonnerError("Chưa đăng nhập — không khôi phục được bản nháp.");
      return false;
    }
    set({ loading: true });
    setRestoreInProgress(true);
    try {
      const loaded = await loadMomentDraft(uid);
      if (!loaded?.meta || loaded.corrupt || !loaded.media) {
        SonnerError(
          "Bản nháp bị hỏng hoặc không đọc được.",
          "Bạn có thể xóa bản nháp và chụp lại.",
        );
        set({ loading: false, showRestoreModal: true });
        setRestoreInProgress(false);
        return false;
      }

      const file = draftMediaToFile(loaded.media);
      if (!file) {
        SonnerError("Không tạo được file từ bản nháp.");
        set({ loading: false });
        setRestoreInProgress(false);
        return false;
      }

      // Fresh object URL after reload
      usePostStore.getState().setMediaFromFile(file);

      const meta = loaded.meta;
      const ov = meta.overlays || meta.optionsData || {};
      useOverlayEditorStore.getState().updateOverlayEditor({
        overlay_id: ov.overlay_id || "standard",
        text: ov.text || meta.caption || "",
        caption: ov.caption || meta.caption || "",
        text_color: ov.text_color || "#FFFFFF",
        icon: ov.icon || {},
        type: ov.type || "default",
        background: ov.background || { colors: [] },
        payload: ov.payload || {},
        color_top: ov.color_top || "",
        color_bottom: ov.color_bottom || "",
      });

      const friendIds = Array.isArray(meta.selectedFriendIds)
        ? meta.selectedFriendIds
        : [];
      usePostStore.getState().setAudience(meta.selectedAudience || "all");
      usePostStore.getState().setSelectedRecipients(friendIds);
      if (meta.optionsData?.selectedGroupId) {
        usePostStore
          .getState()
          .setSelectedGroupId(meta.optionsData.selectedGroupId);
      }
      if (meta.optionsData?.videoCropData) {
        usePostStore
          .getState()
          .setVideoCropData(meta.optionsData.videoCropData);
      }
      if (meta.optionsData?.restoreStreakData) {
        usePostStore
          .getState()
          .setRestoreStreakData(meta.optionsData.restoreStreakData);
      }

      await setMomentDraftStatus(uid, "editing");
      set({
        showRestoreModal: false,
        dismissedRestore: false,
        hasDraft: true,
        draftMeta: { ...meta, status: "editing" },
        loading: false,
      });
      SonnerInfo("Đã khôi phục bài chưa đăng");
      return true;
    } catch (e) {
      console.error("[moment-draft] restore", e);
      SonnerError("Khôi phục bản nháp thất bại", e?.message || "");
      set({ loading: false });
      return false;
    } finally {
      // Allow subsequent edits to autosave again
      setTimeout(() => setRestoreInProgress(false), 400);
    }
  },

  confirmDeleteDraft: async () => {
    const uid = resolveDraftUid();
    if (!uid) return false;
    const ok = await deleteMomentDraft(uid);
    get().clearThumbnail();
    set({
      hasDraft: false,
      draftMeta: null,
      showRestoreModal: false,
      dismissedRestore: false,
    });
    if (ok) SonnerSuccess("Đã xóa bản nháp");
    return ok;
  },

  markPosting: async () => {
    const uid = resolveDraftUid();
    if (!uid) return;
    await setMomentDraftStatus(uid, "posting");
    await get().refreshDraftPresence(uid);
  },

  markEditing: async () => {
    const uid = resolveDraftUid();
    if (!uid) return;
    await setMomentDraftStatus(uid, "editing");
    await get().refreshDraftPresence(uid);
  },

  clearAfterSuccessfulPost: async () => {
    const uid = resolveDraftUid();
    if (!uid) return;
    await deleteMomentDraft(uid);
    get().clearThumbnail();
    set({
      hasDraft: false,
      draftMeta: null,
      showRestoreModal: false,
      dismissedRestore: false,
    });
  },

  /**
   * Before capturing/picking new media when a draft already exists.
   * Returns true if caller may proceed with new file immediately.
   * Returns false if replace prompt is shown (studio empty + draft in IDB).
   */
  requestReplaceOrContinue: async (newFile) => {
    if (isRestoreInProgress()) return true;
    const uid = resolveDraftUid();
    if (!uid) return true;
    const exists = await hasMomentDraft(uid);
    if (!exists) return true;
    // Already editing media in studio → allow overwrite of draft media
    if (usePostStore.getState().selectedFile) return true;
    set({ showReplacePrompt: true, pendingNewFile: newFile || null });
    return false;
  },

  /** Camera / picker: gate then apply setMediaFromFile */
  applyNewMediaFile: async (file, { onApplied } = {}) => {
    if (!file) return false;
    const proceed = await get().requestReplaceOrContinue(file);
    if (!proceed) return false;
    usePostStore.getState().setMediaFromFile(file);
    onApplied?.(file);
    return true;
  },

  cancelReplacePrompt: () =>
    set({ showReplacePrompt: false, pendingNewFile: null }),

  acceptReplaceWithNew: async () => {
    const file = get().pendingNewFile;
    const uid = resolveDraftUid();
    set({ showReplacePrompt: false, pendingNewFile: null });
    if (uid) await deleteMomentDraft(uid);
    get().clearThumbnail();
    set({ hasDraft: false, draftMeta: null, dismissedRestore: false });
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
}));
