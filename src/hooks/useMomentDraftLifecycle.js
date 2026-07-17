import { useEffect, useRef } from "react";
import {
  useAuthStore,
  useMomentDraftStore,
  useOverlayEditorStore,
  usePostStore,
} from "@/stores";
import { resolveDraftUid, requestDraftPersist } from "@/utils/momentDraft";

/**
 * Autosave draft meta, flush on hide/pagehide, offer restore after auth.
 */
export function useMomentDraftLifecycle() {
  const user = useAuthStore((s) => s.user);
  const isAuth = useAuthStore((s) => s.isAuth);
  const checkAndOfferRestore = useMomentDraftStore((s) => s.checkAndOfferRestore);
  const flushMetaSave = useMomentDraftStore((s) => s.flushMetaSave);
  const scheduleMetaSave = useMomentDraftStore((s) => s.scheduleMetaSave);
  const hasDraft = useMomentDraftStore((s) => s.hasDraft);
  const refreshDraftPresence = useMomentDraftStore((s) => s.refreshDraftPresence);
  const prevUid = useRef(null);

  // Ask browser to persist IndexedDB (draft blobs survive eviction better)
  useEffect(() => {
    if (!isAuth) return;
    void requestDraftPersist();
  }, [isAuth]);

  // Auth → check draft for this uid only
  useEffect(() => {
    if (!isAuth || !user) return;
    const uid = resolveDraftUid(user);
    if (!uid) return;
    if (prevUid.current && prevUid.current !== uid) {
      // Account switched — never show previous account draft
      useMomentDraftStore.setState({
        hasDraft: false,
        draftMeta: null,
        showRestoreModal: false,
        dismissedRestore: false,
      });
      useMomentDraftStore.getState().clearThumbnail();
    }
    prevUid.current = uid;
    void checkAndOfferRestore(user);
  }, [isAuth, user, checkAndOfferRestore]);

  // Debounced meta when overlay / audience changes
  useEffect(() => {
    const unsubOverlay = useOverlayEditorStore.subscribe(() => {
      scheduleMetaSave(250);
    });
    const unsubPost = usePostStore.subscribe((state, prev) => {
      if (
        state.audience !== prev.audience ||
        state.selectedRecipients !== prev.selectedRecipients ||
        state.selectedGroupId !== prev.selectedGroupId ||
        state.videoCropData !== prev.videoCropData ||
        state.restoreStreakData !== prev.restoreStreakData
      ) {
        scheduleMetaSave(250);
      }
      // New media file → save blob (capture / pick)
      if (
        state.selectedFile &&
        state.selectedFile !== prev.selectedFile
      ) {
        void useMomentDraftStore.getState().saveMediaFromFile(state.selectedFile);
      }
    });
    return () => {
      unsubOverlay();
      unsubPost();
    };
  }, [scheduleMetaSave]);

  // pagehide / visibility → flush meta (mobile-safe)
  useEffect(() => {
    const flush = () => {
      void flushMetaSave();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, [flushMetaSave]);

  // beforeunload warn when editing draft (best-effort desktop)
  useEffect(() => {
    const onBeforeUnload = (e) => {
      const post = usePostStore.getState();
      if (!hasDraft && !post.selectedFile) return;
      if (post.selectedFile || hasDraft) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDraft]);

  // Keep hasDraft flag fresh
  useEffect(() => {
    if (!isAuth) return;
    void refreshDraftPresence();
  }, [isAuth, refreshDraftPresence]);
}
