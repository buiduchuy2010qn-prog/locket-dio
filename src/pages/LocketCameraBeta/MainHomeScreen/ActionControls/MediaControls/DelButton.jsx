import { X } from "lucide-react";
import { useApp } from "@/context/AppContext.jsx";
import { useCallback, useState } from "react";
import { resetAllPostData } from "@/utils";
import { useMomentDraftStore, usePostStore } from "@/stores";
import ConfirmDeleteModal from "@/components/uikit/ConfirmDeleteModal";

const DelButton = () => {
  const { useloading, camera } = useApp();
  const { sendLoading, uploadLoading } = useloading;

  const resetMedia = usePostStore((s) => s.resetMedia);
  const preview = usePostStore((s) => s.preview);
  const { setCameraActive } = camera;
  const softDeleteDraft = useMomentDraftStore((s) => s.softDeleteDraft);
  const hasDraft = useMomentDraftStore((s) => s.hasDraft);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const discardStudio = useCallback(async () => {
    // Soft-delete draft in IDB (pendingDeletion + Undo toast) when present
    if (hasDraft || useMomentDraftStore.getState().draftMeta?.mediaKey) {
      await softDeleteDraft();
    }

    if (camera.streamRef.current) {
      camera.streamRef.current.getTracks().forEach((track) => track.stop());
      camera.streamRef.current = null;
    }
    resetMedia();
    resetAllPostData();
    setCameraActive(true);
  }, [camera, hasDraft, resetMedia, setCameraActive, softDeleteDraft]);

  const handleConfirmDelete = useCallback(async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await discardStudio();
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }, [deleting, discardStudio]);

  const previewUrl = preview?.data || null;
  const mediaType = preview?.type === "video" ? "video" : "image";

  return (
    <>
      <button
        type="button"
        className="pillSideBtn"
        aria-label="Xóa bài đang chỉnh"
        title="Xóa bài đang chỉnh"
        onClick={() => setConfirmOpen(true)}
        disabled={sendLoading || uploadLoading || deleting}
      >
        <X size={24} strokeWidth={2} />
      </button>

      <ConfirmDeleteModal
        open={confirmOpen}
        onClose={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title="Bạn chắc chắn muốn xóa bài này?"
        description="Hành động này có thể không hoàn tác được."
        keepLabel="Giữ lại"
        deleteLabel="Xóa bài"
        loadingLabel="Đang xóa…"
        previewUrl={previewUrl}
        mediaType={mediaType}
      />
    </>
  );
};

export default DelButton;
