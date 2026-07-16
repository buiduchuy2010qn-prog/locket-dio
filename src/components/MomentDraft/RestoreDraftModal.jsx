import React, { useState } from "react";
import { useMomentDraftStore } from "@/stores";

/**
 * Modal: restore / defer / delete unpublished moment draft.
 */
export default function RestoreDraftModal() {
  const show = useMomentDraftStore((s) => s.showRestoreModal);
  const meta = useMomentDraftStore((s) => s.draftMeta);
  const thumb = useMomentDraftStore((s) => s.thumbnailUrl);
  const loading = useMomentDraftStore((s) => s.loading);
  const restoreDraftIntoStudio = useMomentDraftStore(
    (s) => s.restoreDraftIntoStudio,
  );
  const dismissRestoreForLater = useMomentDraftStore(
    (s) => s.dismissRestoreForLater,
  );
  const confirmDeleteDraft = useMomentDraftStore((s) => s.confirmDeleteDraft);
  const formatSavedAt = useMomentDraftStore((s) => s.formatSavedAt);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!show || !meta) return null;

  const when = formatSavedAt(meta.updatedAt || meta.createdAt);
  const isVideo = meta.mediaType === "video";

  const onContinue = async () => {
    setBusy(true);
    try {
      await restoreDraftIntoStudio();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await confirmDeleteDraft();
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-restore-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-base-100 shadow-xl border border-base-300 overflow-hidden">
        <div className="p-4 pb-2">
          <h2
            id="draft-restore-title"
            className="text-lg font-semibold text-base-content"
          >
            Bạn có một bài chưa đăng
          </h2>
          <p className="text-sm opacity-70 mt-1">
            Được lưu lúc {when || "—"}
          </p>
        </div>

        <div className="px-4">
          <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-base-300">
            {thumb ? (
              isVideo ? (
                <video
                  src={thumb}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={thumb}
                  alt="Xem trước bản nháp"
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm opacity-60">
                {loading ? "Đang tải…" : "Không có xem trước"}
              </div>
            )}
            {isVideo && (
              <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                Video
              </span>
            )}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy || loading}
            onClick={onContinue}
            className="btn btn-primary w-full"
          >
            Tiếp tục chỉnh sửa
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => dismissRestoreForLater()}
            className="btn btn-ghost w-full"
          >
            Để sau
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className={`btn w-full ${confirmDelete ? "btn-error" : "btn-ghost text-error"}`}
          >
            {confirmDelete ? "Xác nhận xóa bản nháp" : "Xóa bản nháp"}
          </button>
          {confirmDelete && (
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => setConfirmDelete(false)}
            >
              Hủy xóa
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Prompt when user starts a new capture while a draft exists.
 */
export function ReplaceDraftPrompt() {
  const show = useMomentDraftStore((s) => s.showReplacePrompt);
  const cancelReplacePrompt = useMomentDraftStore((s) => s.cancelReplacePrompt);
  const acceptReplaceWithNew = useMomentDraftStore((s) => s.acceptReplaceWithNew);
  const continueOldDraftFromPrompt = useMomentDraftStore(
    (s) => s.continueOldDraftFromPrompt,
  );
  const [busy, setBusy] = useState(false);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-base-100 shadow-xl border border-base-300 p-4">
        <h2 className="text-lg font-semibold">Bạn đang có một bài chưa đăng</h2>
        <p className="text-sm opacity-70 mt-2">
          Tiếp tục bài cũ hay thay thế bằng bài mới?
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            className="btn btn-primary w-full"
            onClick={async () => {
              setBusy(true);
              try {
                await continueOldDraftFromPrompt();
              } finally {
                setBusy(false);
              }
            }}
          >
            Tiếp tục bài cũ
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn btn-outline w-full"
            onClick={async () => {
              setBusy(true);
              try {
                await acceptReplaceWithNew();
              } finally {
                setBusy(false);
              }
            }}
          >
            Thay thế bằng bài mới
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => cancelReplacePrompt()}
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
