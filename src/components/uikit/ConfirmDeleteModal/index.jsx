import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

/**
 * Anti-misclick delete confirmation.
 * - "Giữ lại" is primary + default focus (Enter keeps).
 * - "Xóa bài" is red and never auto-focused.
 * - Backdrop click / Escape = keep, never delete.
 * - Only the red button calls onConfirm; disabled while loading.
 */
export default function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  loading = false,
  title = "Bạn chắc chắn muốn xóa bài này?",
  description = "Hành động này có thể không hoàn tác được.",
  keepLabel = "Giữ lại",
  deleteLabel = "Xóa bài",
  loadingLabel = "Đang xóa…",
  previewUrl = null,
  mediaType = "image",
  zIndexClass = "z-[10000]",
}) {
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);
  const keepBtnRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  useEffect(() => {
    if (open) {
      setShowModal(true);
      const t = setTimeout(() => setAnimate(true), 10);
      return () => clearTimeout(t);
    }
    setAnimate(false);
    const t = setTimeout(() => setShowModal(false), 280);
    return () => clearTimeout(t);
  }, [open]);

  // Default focus: keep button only (never the red delete)
  useEffect(() => {
    if (!open || !showModal || loading) return;
    const id = requestAnimationFrame(() => {
      keepBtnRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [open, showModal, loading]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
      // Enter must not fire delete: only focused control receives activation.
      // If focus is outside dialog (edge), force Keep path.
      if (e.key === "Enter" && !loading) {
        const active = document.activeElement;
        const inDialog = dialogRef.current?.contains(active);
        const isDelete =
          active?.getAttribute?.("data-confirm-delete") === "true";
        if (!inDialog || !isDelete) {
          // Let the keep button handle Enter if focused; otherwise treat as keep.
          if (!isDelete && active !== keepBtnRef.current) {
            // Do nothing extra — avoid accidental confirm.
          }
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, loading, onClose]);

  if (!showModal) return null;

  const handleBackdrop = (e) => {
    if (e.target !== e.currentTarget) return;
    if (loading) return;
    // Outside click = keep (cancel), never delete
    onClose?.();
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    onConfirm?.();
  };

  return ReactDOM.createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm transition-opacity duration-300 ${
        animate ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleBackdrop}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        className={`relative w-full max-w-sm rounded-2xl bg-base-100 shadow-xl border border-base-300 overflow-hidden transform transition-all duration-300 text-base-content ${
          animate ? "scale-100 translate-y-0" : "scale-95 translate-y-2"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 pb-2">
          <h2
            id="confirm-delete-title"
            className="text-lg font-semibold text-base-content"
          >
            {title}
          </h2>
          {description ? (
            <p className="text-sm opacity-70 mt-1">{description}</p>
          ) : null}
        </div>

        {previewUrl ? (
          <div className="px-4">
            <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-base-300">
              {mediaType === "video" ? (
                <video
                  src={previewUrl}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Xem trước bài sẽ xóa"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>
        ) : null}

        <div className="p-4 flex flex-col gap-2">
          {/* Keep: primary, first in DOM + default focus (Enter → Giữ lại) */}
          <button
            ref={keepBtnRef}
            type="button"
            disabled={loading}
            autoFocus
            onClick={() => {
              if (!loading) onClose?.();
            }}
            className="btn btn-primary w-full"
          >
            {keepLabel}
          </button>

          {/* Delete: red, never auto-focused */}
          <button
            type="button"
            data-confirm-delete="true"
            disabled={loading}
            tabIndex={0}
            onClick={handleDeleteClick}
            className="btn btn-error btn-outline w-full"
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                {loadingLabel}
              </>
            ) : (
              deleteLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
