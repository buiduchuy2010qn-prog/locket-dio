import React, { useState } from "react";
import { useMomentDraftStore } from "@/stores";
import ConfirmDeleteModal from "@/components/uikit/ConfirmDeleteModal";

/**
 * Single-draft quick restore (when only 1 draft). Multi → DraftLibrary.
 */
export default function RestoreDraftModal() {
  const show = useMomentDraftStore((s) => s.showRestoreModal);
  const meta = useMomentDraftStore((s) => s.draftMeta);
  const drafts = useMomentDraftStore((s) => s.drafts);
  const loading = useMomentDraftStore((s) => s.loading);
  const restoreDraftIntoStudio = useMomentDraftStore(
    (s) => s.restoreDraftIntoStudio,
  );
  const dismissRestoreForLater = useMomentDraftStore(
    (s) => s.dismissRestoreForLater,
  );
  const confirmDeleteDraft = useMomentDraftStore((s) => s.confirmDeleteDraft);
  const openLibrary = useMomentDraftStore((s) => s.openLibrary);
  const formatSavedAt = useMomentDraftStore((s) => s.formatSavedAt);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!show || !meta) return null;

  const when = formatSavedAt(meta.updatedAt || meta.createdAt);
  const draftId = meta.id || drafts[0]?.id;

  const onContinue = async () => {
    setBusy(true);
    try {
      await restoreDraftIntoStudio(draftId);
    } finally {
      setBusy(false);
    }
  };

  const onConfirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await confirmDeleteDraft(draftId);
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
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
              Bạn có bản nháp chưa đăng
            </h2>
            <p className="text-sm opacity-70 mt-1">
              Được lưu lúc {when || "—"}
              {drafts.length > 1 ? ` · ${drafts.length} bản nháp` : ""}
            </p>
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
            {drafts.length > 1 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  dismissRestoreForLater();
                  openLibrary();
                }}
                className="btn btn-outline w-full"
              >
                Xem tất cả bản nháp
              </button>
            )}
            <button
              type="button"
              disabled={busy || deleting}
              onClick={() => dismissRestoreForLater()}
              className="btn btn-ghost w-full"
            >
              Để sau
            </button>
            <button
              type="button"
              disabled={busy || deleting}
              onClick={() => setConfirmDeleteOpen(true)}
              className="btn btn-ghost w-full text-error"
            >
              Xóa bản nháp
            </button>
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        open={confirmDeleteOpen}
        title="Xóa bản nháp?"
        description="Xóa vĩnh viễn bản nháp này? Ảnh/video chưa đăng sẽ không thể khôi phục."
        deleteLabel="Xóa"
        keepLabel="Hủy"
        loading={deleting}
        onConfirm={onConfirmDelete}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}

/**
 * Prompt when user starts a new capture while a draft exists.
 * Multi-draft: allow new capture (new UUID) — no forced replace.
 */
export function ReplaceDraftPrompt() {
  const show = useMomentDraftStore((s) => s.showReplacePrompt);
  const cancelReplacePrompt = useMomentDraftStore((s) => s.cancelReplacePrompt);
  const acceptReplaceWithNew = useMomentDraftStore(
    (s) => s.acceptReplaceWithNew,
  );
  const openLibrary = useMomentDraftStore((s) => s.openLibrary);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm rounded-2xl bg-base-100 p-4 border border-base-300 shadow-xl">
        <h3 className="font-semibold mb-2">Bạn đang có bản nháp</h3>
        <p className="text-sm opacity-70 mb-4">
          Chụp mới sẽ lưu thành bản nháp riêng — không ghi đè bản cũ.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="btn btn-primary w-full"
            onClick={() => acceptReplaceWithNew()}
          >
            Chụp / chọn mới
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => {
              cancelReplacePrompt();
              openLibrary();
            }}
          >
            Xem bản nháp
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
