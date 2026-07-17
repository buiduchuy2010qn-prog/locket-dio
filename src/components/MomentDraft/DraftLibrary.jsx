import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Image as ImageIcon, Video, RefreshCw } from "lucide-react";
import { useMomentDraftStore } from "@/stores";
import { useConnectivityStore } from "@/stores/useConnectivityStore";
import {
  getDraftThumbnailBlob,
  DRAFT_STATUS,
  statusLabel,
  formatDraftSavedAt,
} from "@/utils/momentDraft";

/**
 * Offline multi-draft library sheet.
 * Does not move camera layout — overlays as fixed panel.
 */
export default function DraftLibrary() {
  const open = useMomentDraftStore((s) => s.libraryOpen);
  const closeLibrary = useMomentDraftStore((s) => s.closeLibrary);
  const drafts = useMomentDraftStore((s) => s.drafts);
  const filter = useMomentDraftStore((s) => s.libraryFilter);
  const setLibraryFilter = useMomentDraftStore((s) => s.setLibraryFilter);
  const refreshList = useMomentDraftStore((s) => s.refreshList);
  const restoreDraftIntoStudio = useMomentDraftStore(
    (s) => s.restoreDraftIntoStudio,
  );
  const postDraftById = useMomentDraftStore((s) => s.postDraftById);
  const confirmDeleteDraft = useMomentDraftStore((s) => s.confirmDeleteDraft);
  const postingDraftId = useMomentDraftStore((s) => s.postingDraftId);
  const isOffline = useConnectivityStore((s) => s.isOffline);

  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (open) void refreshList();
  }, [open, refreshList]);

  const filtered = useMemo(() => {
    if (filter === "image") return drafts.filter((d) => d.mediaType === "image");
    if (filter === "video") return drafts.filter((d) => d.mediaType === "video");
    if (filter === "failed")
      return drafts.filter((d) => d.status === DRAFT_STATUS.FAILED);
    return drafts;
  }, [drafts, filter]);

  if (!open) return null;

  const onEdit = async (id) => {
    setBusyId(id);
    try {
      await restoreDraftIntoStudio(id);
    } finally {
      setBusyId(null);
    }
  };

  const onPost = async (id) => {
    if (postingDraftId || isOffline) return;
    setBusyId(id);
    try {
      await postDraftById(id);
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (id) => {
    setBusyId(id);
    try {
      await confirmDeleteDraft(id);
      setConfirmId(null);
    } finally {
      setBusyId(null);
    }
  };

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
            Bản nháp
          </h2>
          <p className="text-xs opacity-60">
            {drafts.length} bản · ngoại tuyến an toàn
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

      <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0">
        {[
          { id: "all", label: "Tất cả" },
          { id: "image", label: "Ảnh" },
          { id: "video", label: "Video" },
          { id: "failed", label: "Thất bại" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setLibraryFilter(f.id)}
            className={`btn btn-xs rounded-full ${
              filter === f.id ? "btn-primary" : "btn-ghost bg-base-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-8">
        {!filtered.length ? (
          <div className="text-center opacity-60 py-16 text-sm">
            Chưa có bản nháp
          </div>
        ) : (
          <ul className="flex flex-col gap-3" style={{ contentVisibility: "auto" }}>
            {filtered.map((d) => (
              <DraftRow
                key={d.id}
                draft={d}
                busy={busyId === d.id || postingDraftId === d.id}
                posting={postingDraftId === d.id}
                offline={isOffline}
                onView={() => onEdit(d.id)}
                onEdit={() => onEdit(d.id)}
                onPost={() => onPost(d.id)}
                onDelete={() => setConfirmId(d.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-sm rounded-2xl bg-base-100 p-4 shadow-xl border border-base-300">
            <p className="text-sm font-medium mb-4">
              Xóa vĩnh viễn bản nháp này? Ảnh/video chưa đăng sẽ không thể khôi
              phục.
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

function DraftRow({
  draft,
  busy,
  posting,
  offline,
  onView,
  onEdit,
  onPost,
  onDelete,
}) {
  const [thumbUrl, setThumbUrl] = useState(null);
  const urlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const blob = await getDraftThumbnailBlob(draft.id);
      if (cancelled) return;
      if (urlRef.current) {
        try {
          URL.revokeObjectURL(urlRef.current);
        } catch {
          /* ignore */
        }
      }
      if (blob) {
        const u = URL.createObjectURL(blob);
        urlRef.current = u;
        setThumbUrl(u);
      } else {
        setThumbUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (urlRef.current) {
        try {
          URL.revokeObjectURL(urlRef.current);
        } catch {
          /* ignore */
        }
        urlRef.current = null;
      }
    };
  }, [draft.id]);

  const isVideo = draft.mediaType === "video";
  const musicName =
    draft.music?.song_title ||
    draft.music?.song_name ||
    draft.overlays?.payload?.song_title ||
    "";
  const caption = (draft.caption || "").trim();
  const failed = draft.status === DRAFT_STATUS.FAILED;

  return (
    <li
      className="rounded-xl border border-base-300 bg-base-200/60 p-3 flex gap-3"
      style={{ contentVisibility: "auto", containIntrinsicSize: "96px" }}
    >
      <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-base-300">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-50">
            {isVideo ? <Video size={22} /> : <ImageIcon size={22} />}
          </div>
        )}
        <span className="absolute bottom-1 left-1 text-[10px] px-1 rounded bg-black/55 text-white">
          {isVideo ? "Video" : "Ảnh"}
        </span>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {caption || (isVideo ? "Video không caption" : "Ảnh không caption")}
            </p>
            {musicName ? (
              <p className="text-xs opacity-70 truncate">🎵 {musicName}</p>
            ) : null}
            <p className="text-[11px] opacity-50">
              {formatDraftSavedAt(draft.updatedAt || draft.createdAt)}
            </p>
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
              failed
                ? "bg-error/20 text-error"
                : draft.status === DRAFT_STATUS.POSTING
                  ? "bg-warning/20 text-warning"
                  : "bg-success/15 text-success"
            }`}
          >
            {statusLabel(draft.status)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-1">
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            disabled={busy}
            onClick={onView}
          >
            Xem
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            disabled={busy}
            onClick={onEdit}
          >
            Chỉnh sửa
          </button>
          <button
            type="button"
            className="btn btn-primary btn-xs"
            disabled={busy || posting || offline}
            title={
              offline
                ? "Đang ngoại tuyến"
                : failed
                  ? "Thử lại"
                  : "Đăng"
            }
            onClick={onPost}
          >
            {posting ? (
              "Đang đăng…"
            ) : failed ? (
              <span className="inline-flex items-center gap-1">
                <RefreshCw size={12} /> Thử lại
              </span>
            ) : (
              "Đăng"
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs text-error"
            disabled={busy || posting}
            onClick={onDelete}
          >
            Xóa
          </button>
        </div>
      </div>
    </li>
  );
}
