import React from "react";
import { FileText } from "lucide-react";
import { useMomentDraftStore, usePostStore } from "@/stores";

/**
 * Re-open dismissed unpublished draft ("Để sau").
 * Icon-only inside control pill — yellow badge, no text label.
 */
export default function DraftButton() {
  const hasDraft = useMomentDraftStore((s) => s.hasDraft);
  const openRestoreModal = useMomentDraftStore((s) => s.openRestoreModal);
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);

  const studioEmpty = !selectedFile && !preview?.data;
  if (!hasDraft || !studioEmpty) return null;

  return (
    <button
      type="button"
      className="pillSideBtn"
      onClick={() => openRestoreModal()}
      aria-label="Bản nháp chưa đăng"
      title="Bản nháp chưa đăng"
    >
      <span className="relative inline-flex">
        <FileText size={24} strokeWidth={2} />
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-black/40"
          aria-hidden
        />
      </span>
    </button>
  );
}
