import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  X,
  MoreVertical,
  Image as ImageIcon,
  Video,
  Play,
  Camera,
} from "lucide-react";
import { useMomentDraftStore } from "@/stores";
import { useConnectivityStore } from "@/stores/useConnectivityStore";
import { OverlayRenderer } from "@/components/Overlay";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import {
  getDraftThumbnailBlob,
  getDraftMediaBlob,
  DRAFT_STATUS,
  formatDraftStatusLine,
  formatDraftCreatedAt,
} from "@/utils/momentDraft";

/**
 * Multi-draft library — large post-like previews (feed-style OverlayRenderer).
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
  const isOffline = useConnectivityStore((s) => s.isOffline);

  const listRef = useRef(null);
  const scrollRestoreRef = useRef(0);
  const offlineToastOnce = useRef(false);

  const [confirmId, setConfirmId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [busyId, setBusyId] = useState(null);

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[190] flex flex-col bg-base-100 text-base-content"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-lib-title"
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-base-300 shrink-0">
        <div>
          <h2 id="draft-lib-title" className="text-lg font-semibold">
            Thư viện bản nháp
          </h2>
          <p className="text-xs opacity-60">
            {drafts.length
              ? `${drafts.length} bản chưa đăng`
              : "Chưa có bản nháp"}
            {isOffline ? " · Ngoại tuyến" : ""}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          onClick={closeLibrary}
          aria-label="Đóng"
        >
          <X size={20} />
        </button>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 pb-10">
        {!sorted.length ? (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6 gap-3">
            <p className="text-base font-semibold">Chưa có bản nháp</p>
            <p className="text-sm opacity-60 max-w-xs">
              Ảnh và video chưa đăng sẽ xuất hiện tại đây.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm gap-2 mt-2"
              onClick={closeLibrary}
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
              />
            ))}
          </ul>
        )}
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm rounded-2xl bg-base-100 p-4 shadow-xl border border-base-300">
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
  const statusLine = formatDraftStatusLine(draft);
  const overlayData = useMemo(() => buildOverlayData(draft), [draft]);
  const editedHint =
    draft.updatedAt &&
    draft.createdAt &&
    draft.updatedAt - draft.createdAt > 60_000
      ? `Đã sửa · ${formatDraftCreatedAt(draft.updatedAt)}`
      : null;

  // Thumbnail ASAP
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const blob = await getDraftThumbnailBlob(draft.id);
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
  }, [draft.id]);

  // Near-viewport → load full media blob
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
      const blob = await getDraftMediaBlob(draft.id);
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
  }, [nearView, draft.id]);

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
          className="w-full text-left border border-base-300 rounded-[28px] sm:rounded-[40px] overflow-hidden bg-base-300/40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-base-300/30 to-base-100/20">
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
              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                {isVideo ? <Video size={40} /> : <ImageIcon size={40} />}
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
