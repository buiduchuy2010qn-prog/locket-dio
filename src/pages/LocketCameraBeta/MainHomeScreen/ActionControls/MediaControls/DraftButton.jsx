import React from "react";
import { FileText } from "lucide-react";
import { useMomentDraftStore, usePostStore } from "@/stores";

/**
 * Re-open dismissed unpublished draft ("Để sau").
 * Visible when a draft exists for this uid and studio is empty or user dismissed modal.
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
      className="cursor-pointer active:scale-95 flex flex-col items-center gap-0.5"
      onClick={() => openRestoreModal()}
      aria-label="Bản nháp chưa đăng"
      title="Bản nháp chưa đăng"
    >
      <span className="relative">
        <FileText size={30} />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400" />
      </span>
      <span className="text-[9px] font-medium opacity-80">Bản nháp</span>
    </button>
  );
}
