import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  X,
  MoreVertical,
  Image as ImageIcon,
  Video,
  Play,
  Camera,
  RefreshCw,
} from "lucide-react";
import { useMomentDraftStore, usePostStore } from "@/stores";
import { useConnectivityStore } from "@/stores/useConnectivityStore";
import { useAppCamera } from "@/context/AppContext";
import { OverlayRenderer } from "@/components/Overlay";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import {
  getDraftThumbnailBlob,
  getDraftMediaBlob,
  ensureLocalThumbnail,
  ensureLocalMedia,
  DRAFT_STATUS,
  SYNC_STATUS,
  formatDraftStatusLine,
  formatDraftCreatedAt,
} from "@/utils/momentDraft";

/**
 * Full-screen draft library — opaque page, not a glass overlay on camera.
 * Pauses camera stream while open to avoid lag.
 * Opened only when user taps the draft badge (never auto).
 */
export default function DraftLibrary() {
  const open = useMomentDraftStore((s) => s.libraryOpen);
  const closeLibrary = useMomentDraftStore((s) => s.closeLibrary);
  const drafts = useMomentDraftStore((s) => s.drafts);
  const refreshList = useMomentDraftStore((s) => s.refreshList);
  const restoreDraftIntoStudio = useMomentDraftStore(
    (s) => s.restoreDraftIntoStudio,
  );
  const postDraftById = useMomentDraftStore((s) => s.postDraftById);
  const confirmDeleteDraft = useMomentDraftStore((s) => s.confirmDeleteDraft);
  const duplicateDraft = useMomentDraftStore((s) => s.duplicateDraft);
  const postingDraftId = useMomentDraftStore((s) => s.postingDraftId);
  const retrySyncDraft = useMomentDraftStore((s) => s.retrySyncDraft);
  const syncDraftsNow = useMomentDraftStore((s) => s.syncDraftsNow);
  const isOffline = useConnectivityStore((s) => s.isOffline);
  const camera = useAppCamera();
  const setCameraActive = camera?.setCameraActive;

  const listRef = useRef(null);
  const scrollRestoreRef = useRef(0);
  const offlineToastOnce = useRef(false);
  const cameraPausedRef = useRef(false);

  const [confirmId, setConfirmId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // Opaque page: pause camera + lock body scroll (tránh camera xuyên + lag)
  useEffect(() => {
    if (!open) return undefined;

    cameraPausedRef.current = true;
    try {
      setCameraActive?.(false);
      const stream = camera?.streamRef?.current;
      stream?.getVideoTracks?.()?.forEach((t) => {
        try {
          t.enabled = false;
        } catch {
          /* ignore */
        }
      });
      const videoEl = camera?.videoRef?.current;
      if (videoEl) {
        try {
          videoEl.pause?.();
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }

    const prevOverflow = document.body.style.overflow;
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.documentElement.classList.add("draft-library-open");

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
      document.documentElement.classList.remove("draft-library-open");

      // Resume camera only if studio has no media (user just closed library)
      const post = usePostStore.getState();
      const hasStudioMedia = !!(post.selectedFile || post.preview?.data);
      if (!hasStudioMedia && cameraPausedRef.current) {
        try {
          const stream = camera?.streamRef?.current;
          stream?.getVideoTracks?.()?.forEach((t) => {
            try {
              t.enabled = true;
            } catch {
              /* ignore */
            }
          });
          setCameraActive?.(true);
        } catch {
          /* ignore */
        }
      }
      cameraPausedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on open/close
  }, [open]);

  useEffect(() => {
    if (!open) {
      offlineToastOnce.current = false;
      setMenuId(null);
      setConfirmId(null);
      return;
    }
    void refreshList();
    // restore scroll after list re-renders (e.g. post success)
    requestAnimationFrame(() => {
      if (listRef.current && scrollRestoreRef.current > 0) {
        listRef.current.scrollTop = scrollRestoreRef.current;
      }
    });
    if (isOffline && !offlineToastOnce.current) {
      offlineToastOnce.current = true;
      SonnerInfo("Đang ngoại tuyến · Bản nháp vẫn được lưu");
    }
  }, [open, refreshList, isOffline, drafts.length]);

  // Close ⋮ menu on outside / escape
  useEffect(() => {
    if (!menuId) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuId(null);
    };
    const onDown = () => setMenuId(null);
    window.addEventListener("keydown", onKey);
    // delay so open click doesn't immediately close
    const t = setTimeout(() => window.addEventListener("click", onDown), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onDown);
    };
  }, [menuId]);

  const sorted = useMemo(
    () =>
      [...drafts].sort(
        (a, b) =>
          (b.createdAt || b.updatedAt || 0) -
          (a.createdAt || a.updatedAt || 0),
      ),
    [drafts],
  );

  const saveScroll = () => {
    if (listRef.current) {
      scrollRestoreRef.current = listRef.current.scrollTop;
    }
  };

  const onEdit = async (id) => {
    setMenuId(null);
    saveScroll();
    setBusyId(id);
    try {
      await restoreDraftIntoStudio(id);
    } finally {
      setBusyId(null);
    }
  };

  const onPost = async (id) => {
    setMenuId(null);
    if (postingDraftId || isOffline) return;
    saveScroll();
    setBusyId(id);
    try {
      await postDraftById(id);
    } finally {
      setBusyId(null);
    }
  };

  const onDuplicate = async (id) => {
    setMenuId(null);
    setBusyId(id);
    try {
      await duplicateDraft(id);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (id) => {
    setBusyId(id);
    try {
      await confirmDeleteDraft(id);
      setConfirmId(null);
      setMenuId(null);
    } finally {
      setBusyId(null);
    }
  };

  const handleClose = () => {
    closeLibrary();
  };

  const handleSync = async () => {
    if (syncing || isOffline) return;
    setSyncing(true);
    try {
      await syncDraftsNow?.();
    } finally {
      setSyncing(false);
    }
  };

  if (!open) return null;

  const shell = (
    <div
      className="draft-library-root fixed inset-0 z-[320] flex flex-col text-base-content isolate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-lib-title"
      data-draft-library="true"
    >
      <header
        className="relative z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-base-300 shrink-0 bg-inherit"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        }}
      >
        <div className="min-w-0">
          <h2 id="draft-lib-title" className="text-lg font-semibold truncate">
            Thư viện bản nháp
          </h2>
          <p className="text-xs opacity-60 truncate">
            {drafts.length
              ? `${drafts.length} bản chưa đăng`
              : "Chưa có bản nháp"}
            {isOffline ? " · Ngoại tuyến" : " · Đồng bộ theo tài khoản"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isOffline && (
            <button
              type="button"
              className="btn btn-ghost btn-sm gap-1"
              disabled={syncing}
              onClick={() => void handleSync()}
            >
              <RefreshCw
                size={14}
                className={syncing ? "animate-spin" : undefined}
              />
              Đồng bộ
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={handleClose}
            aria-label="Đóng thư viện"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div
        ref={listRef}
        className="relative z-10 flex-1 overflow-y-auto overscroll-contain px-3 py-4 bg-inherit"
        style={{
          paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {!sorted.length ? (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6 gap-3 min-h-[50vh]">
            <div className="w-16 h-16 rounded-2xl bg-base-200 flex items-center justify-center opacity-80">
              <ImageIcon size={28} />
            </div>
            <p className="text-base font-semibold">Chưa có bản nháp</p>
            <p className="text-sm opacity-60 max-w-xs">
              Ảnh và video chưa đăng sẽ xuất hiện tại đây.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm gap-2 mt-2"
              onClick={handleClose}
            >
              <Camera size={16} />
              Mở camera
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-6 max-w-md mx-auto w-full">
            {sorted.map((d) => (
              <DraftPreviewCard
                key={d.id}
                draft={d}
                busy={busyId === d.id || postingDraftId === d.id}
                posting={postingDraftId === d.id}
                offline={isOffline}
                menuOpen={menuId === d.id}
                onToggleMenu={(e) => {
                  e?.stopPropagation?.();
                  setMenuId((cur) => (cur === d.id ? null : d.id));
                }}
                onEdit={() => onEdit(d.id)}
                onPost={() => onPost(d.id)}
                onDuplicate={() => onDuplicate(d.id)}
                onDeleteRequest={() => {
                  setMenuId(null);
                  setConfirmId(d.id);
                }}
                onRetryFailed={() => {
                  if (isOffline) return;
                  void onPost(d.id);
                }}
                onRetrySync={() => {
                  if (isOffline) return;
                  void retrySyncDraft?.(d.id);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {confirmId && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-sm rounded-2xl p-4 shadow-xl border border-base-300 bg-base-100">
            <p className="text-base font-semibold mb-1">Xóa bản nháp này?</p>
            <p className="text-sm opacity-70 mb-4">
              Ảnh/video chưa đăng sẽ không thể khôi phục.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmId(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-error btn-sm"
                disabled={busyId === confirmId}
                onClick={() => onDelete(confirmId)}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Portal ra body — tách hẳn khỏi layout camera (z-index / transparency)
  if (typeof document !== "undefined" && document.body) {
    return createPortal(shell, document.body);
  }
  return shell;
}

function buildOverlayData(draft) {
  const ov = draft?.overlays || draft?.optionsData || {};
  const caption = draft?.caption || ov.caption || ov.text || "";
  const style = draft?.captionStyle || {};
  const music = draft?.music || null;
  const type =
    ov.type ||
    style.type ||
    (music || ov.payload?.isrc || ov.payload?.song_title ? "music" : "default");

  return {
    ...ov,
    overlay_id: ov.overlay_id || style.overlay_id || "standard",
    type,
    text: ov.text || ov.caption || caption,
    caption: ov.caption || ov.text || caption,
    text_color: ov.text_color || style.text_color || "#FFFFFF",
    background: ov.background || style.background || { colors: [] },
    color_top: ov.color_top || style.color_top || "",
    color_bottom: ov.color_bottom || style.color_bottom || "",
    icon: ov.icon || style.icon || {},
    payload:
      ov.payload ||
      (music
        ? {
            ...music,
            song_title: music.song_title || music.song_name,
          }
        : {}),
  };
}

function DraftPreviewCard({
  draft,
  busy,
  posting,
  offline,
  menuOpen,
  onToggleMenu,
  onEdit,
  onPost,
  onDuplicate,
  onDeleteRequest,
  onRetryFailed,
  onRetrySync,
}) {
  const rootRef = useRef(null);
  const thumbUrlRef = useRef(null);
  const mediaUrlRef = useRef(null);
  const videoRef = useRef(null);

  const [thumbUrl, setThumbUrl] = useState(null);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [nearView, setNearView] = useState(false);
  const [playing, setPlaying] = useState(false);

  const isVideo = draft.mediaType === "video";
  const failed = draft.status === DRAFT_STATUS.FAILED;
  const syncFailed =
    draft.syncStatus === SYNC_STATUS.SYNC_FAILED ||
    draft.syncStatus === SYNC_STATUS.CONFLICT;
  const statusLine = formatDraftStatusLine(draft);
  const overlayData = useMemo(() => buildOverlayData(draft), [draft]);
  const editedHint =
    draft.updatedAt &&
    draft.createdAt &&
    draft.updatedAt - draft.createdAt > 60_000
      ? `Đã sửa · ${formatDraftCreatedAt(draft.updatedAt)}`
      : null;

  // Thumbnail ASAP — local IDB, rồi tải từ tài khoản (thiết bị khác / URL ký hết hạn)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let blob = await getDraftThumbnailBlob(draft.id);
      if (!blob && !offline) {
        try {
          const r = await ensureLocalThumbnail(draft.id);
          blob = r?.blob || (await getDraftThumbnailBlob(draft.id));
        } catch {
          /* network */
        }
      }
      if (cancelled || !blob) return;
      if (thumbUrlRef.current) {
        try {
          URL.revokeObjectURL(thumbUrlRef.current);
        } catch {
          /* ignore */
        }
      }
      const u = URL.createObjectURL(blob);
      thumbUrlRef.current = u;
      setThumbUrl(u);
    })();
    return () => {
      cancelled = true;
      if (thumbUrlRef.current) {
        try {
          URL.revokeObjectURL(thumbUrlRef.current);
        } catch {
          /* ignore */
        }
        thumbUrlRef.current = null;
      }
    };
  }, [draft.id, offline]);

  // Near-viewport → load full media blob (pull from cloud if shell-only)
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setNearView(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNearView(true);
        }
      },
      { root: null, rootMargin: "240px 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!nearView) return undefined;
    let cancelled = false;
    (async () => {
      let blob = await getDraftMediaBlob(draft.id);
      if (!blob && !offline) {
        try {
          await ensureLocalMedia(draft.id);
          blob = await getDraftMediaBlob(draft.id);
          // refresh thumb if it filled during media download
          if (!thumbUrlRef.current) {
            const t = await getDraftThumbnailBlob(draft.id);
            if (t && !cancelled) {
              const u = URL.createObjectURL(t);
              thumbUrlRef.current = u;
              setThumbUrl(u);
            }
          }
        } catch {
          /* network */
        }
      }
      if (cancelled || !blob) return;
      if (mediaUrlRef.current) {
        try {
          URL.revokeObjectURL(mediaUrlRef.current);
        } catch {
          /* ignore */
        }
      }
      const u = URL.createObjectURL(blob);
      mediaUrlRef.current = u;
      setMediaUrl(u);
    })();
    return () => {
      cancelled = true;
      if (mediaUrlRef.current) {
        try {
          URL.revokeObjectURL(mediaUrlRef.current);
        } catch {
          /* ignore */
        }
        mediaUrlRef.current = null;
      }
      setMediaUrl(null);
      setPlaying(false);
    };
  }, [nearView, draft.id, offline]);

  const togglePlay = useCallback(
    (e) => {
      e?.stopPropagation?.();
      const v = videoRef.current;
      if (!v || !mediaUrl) return;
      if (v.paused) {
        v.muted = true;
        void v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        v.pause();
        setPlaying(false);
      }
    },
    [mediaUrl],
  );

  return (
    <li ref={rootRef} className="list-none">
      <div className="relative">
        {/* ⋮ menu */}
        <div className="absolute top-3 right-3 z-30">
          <button
            type="button"
            className="btn btn-circle btn-sm bg-black/45 border-0 text-white hover:bg-black/60"
            aria-label="Thao tác bản nháp"
            disabled={busy}
            onClick={onToggleMenu}
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 mt-1 w-44 rounded-xl bg-base-100 border border-base-300 shadow-xl overflow-hidden z-40"
              onClick={(e) => e.stopPropagation()}
              role="menu"
            >
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-base-200"
                disabled={busy}
                onClick={onEdit}
              >
                Chỉnh sửa
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-base-200 disabled:opacity-40"
                disabled={busy || posting || offline}
                title={offline ? "Cần kết nối mạng" : undefined}
                onClick={onPost}
              >
                {offline
                  ? "Đăng ngay (Cần kết nối mạng)"
                  : posting
                    ? "Đang đăng…"
                    : "Đăng ngay"}
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-base-200"
                disabled={busy}
                onClick={onDuplicate}
              >
                Nhân bản
              </button>
              {(syncFailed ||
                draft.syncStatus === SYNC_STATUS.PENDING_SYNC ||
                !draft.syncStatus) && (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-base-200 disabled:opacity-40"
                  disabled={busy || offline}
                  onClick={onRetrySync}
                >
                  Thử đồng bộ lại
                </button>
              )}
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm text-error hover:bg-base-200"
                disabled={busy || posting}
                onClick={onDeleteRequest}
              >
                Xóa
              </button>
            </div>
          )}
        </div>

        {/* Large square preview — tap opens editor (not post/delete) */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Chỉnh sửa bản nháp"
          aria-disabled={busy || undefined}
          onClick={() => {
            if (!busy) onEdit();
          }}
          onKeyDown={(e) => {
            if (busy) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onEdit();
            }
          }}
          className="draft-library-card w-full text-left border border-base-300 rounded-[28px] sm:rounded-[40px] overflow-hidden shadow-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {/* Nền đặc — không trong suốt xuyên camera */}
          <div className="relative aspect-square w-full overflow-hidden draft-library-card">
            {/* Thumbnail always under */}
            {thumbUrl ? (
              <img
                src={thumbUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
                  mediaUrl && !isVideo ? "opacity-0" : "opacity-100"
                }`}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-base-content/40">
                {isVideo ? <Video size={40} /> : <ImageIcon size={40} />}
                <span className="text-xs">
                  {offline ? "Chưa có ảnh local" : "Đang tải…"}
                </span>
              </div>
            )}

            {/* Image full media when ready */}
            {!isVideo && mediaUrl ? (
              <img
                src={mediaUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}

            {/* Video: poster + play (muted); no autoplay of every card */}
            {isVideo && mediaUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={mediaUrl}
                  poster={thumbUrl || undefined}
                  className={`absolute inset-0 w-full h-full object-cover ${
                    playing ? "opacity-100" : "opacity-0"
                  }`}
                  muted
                  playsInline
                  loop
                  preload="metadata"
                  onPause={() => setPlaying(false)}
                  onPlay={() => setPlaying(true)}
                />
                {!playing && (
                  <button
                    type="button"
                    className="absolute inset-0 z-10 flex items-center justify-center"
                    aria-label="Phát video"
                    onClick={togglePlay}
                  >
                    <span className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center text-white">
                      <Play size={28} fill="currentColor" />
                    </span>
                  </button>
                )}
              </>
            ) : null}

            {/* Caption / music / decorative — same renderer as feed */}
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-2">
              <OverlayRenderer
                overlayData={overlayData}
                momentId={`draft-${draft.id}`}
              />
            </div>

            {posting && (
              <div className="absolute inset-0 z-20 bg-black/35 flex items-center justify-center">
                <span className="loading loading-spinner loading-md text-white" />
              </div>
            )}
          </div>
        </div>

        <div className="px-1 pt-2">
          <button
            type="button"
            className={`text-sm text-left w-full ${
              failed ? "text-error font-medium" : "opacity-70"
            }`}
            disabled={busy || (failed && offline)}
            onClick={(e) => {
              e.stopPropagation();
              if (failed && !offline) onRetryFailed();
              else onEdit();
            }}
          >
            {statusLine}
          </button>
          {editedHint ? (
            <p className="text-[11px] opacity-45 mt-0.5">{editedHint}</p>
          ) : null}
          {offline ? (
            <p className="text-[11px] opacity-50 mt-0.5">
              Cần kết nối mạng để đăng
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}
