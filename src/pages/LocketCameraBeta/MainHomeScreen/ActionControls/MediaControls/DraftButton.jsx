import React from "react";
import { FileText } from "lucide-react";
import { useMomentDraftStore, usePostStore } from "@/stores";

/**
 * Open draft library (multi-draft). Reuses existing pill slot — no extra camera button.
 */
export default function DraftButton() {
  const draftCount = useMomentDraftStore((s) => s.draftCount);
  const hasDraft = useMomentDraftStore((s) => s.hasDraft);
  const openRestoreModal = useMomentDraftStore((s) => s.openRestoreModal);
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);

  const studioEmpty = !selectedFile && !preview?.data;
  // Show when there are drafts and studio is empty (same placement as before)
  if ((!hasDraft && draftCount < 1) || !studioEmpty) return null;

  const count = draftCount || (hasDraft ? 1 : 0);

  return (
    <button
      type="button"
      className="pillSideBtn"
      onClick={() => openRestoreModal()}
      aria-label={`Bản nháp (${count})`}
      title={`Bản nháp (${count})`}
    >
      <span className="relative inline-flex">
        <FileText size={24} strokeWidth={2} />
        <span
          className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-amber-400 text-[9px] font-bold text-black flex items-center justify-center ring-2 ring-black/40"
          aria-hidden
        >
          {count > 9 ? "9+" : count}
        </span>
      </span>
    </button>
  );
}
