import { useEffect, useRef } from "react";
import {
  useAuthStore,
  useMomentDraftStore,
  useOverlayEditorStore,
  usePostStore,
} from "@/stores";
import { resolveDraftUid, requestDraftPersist } from "@/utils/momentDraft";

/**
 * Multi-draft autosave: meta → activeDraftId only; media after capture.
 */
export function useMomentDraftLifecycle() {
  const user = useAuthStore((s) => s.user);
  const isAuth = useAuthStore((s) => s.isAuth);
  const checkAndOfferRestore = useMomentDraftStore((s) => s.checkAndOfferRestore);
  const flushMetaSave = useMomentDraftStore((s) => s.flushMetaSave);
  const scheduleMetaSave = useMomentDraftStore((s) => s.scheduleMetaSave);
  const draftCount = useMomentDraftStore((s) => s.draftCount);
  const hasDraft = useMomentDraftStore((s) => s.hasDraft);
  const refreshDraftPresence = useMomentDraftStore((s) => s.refreshDraftPresence);
  const prevUid = useRef(null);

  useEffect(() => {
    if (!isAuth) return;
    void requestDraftPersist();
  }, [isAuth]);

  useEffect(() => {
    if (!isAuth || !user) return;
    const uid = resolveDraftUid(user);
    if (!uid) return;
    if (prevUid.current && prevUid.current !== uid) {
      useMomentDraftStore.setState({
        hasDraft: false,
        draftMeta: null,
        drafts: [],
        draftCount: 0,
        activeDraftId: null,
        showRestoreModal: false,
        dismissedRestore: false,
        libraryOpen: false,
      });
      useMomentDraftStore.getState().clearThumbnail();
    }
    prevUid.current = uid;
    void checkAndOfferRestore(user);
  }, [isAuth, user, checkAndOfferRestore]);

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
      // New media file → bind to active draft or create NEW uuid (never overwrite others)
      if (state.selectedFile && state.selectedFile !== prev.selectedFile) {
        void useMomentDraftStore.getState().saveMediaFromFile(state.selectedFile);
      }
    });
    return () => {
      unsubOverlay();
      unsubPost();
    };
  }, [scheduleMetaSave]);

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

  useEffect(() => {
    const onBeforeUnload = (e) => {
      const post = usePostStore.getState();
      if (!hasDraft && !draftCount && !post.selectedFile) return;
      if (post.selectedFile || hasDraft || draftCount) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDraft, draftCount]);

  useEffect(() => {
    if (!isAuth) return;
    void refreshDraftPresence();
  }, [isAuth, refreshDraftPresence]);
}
