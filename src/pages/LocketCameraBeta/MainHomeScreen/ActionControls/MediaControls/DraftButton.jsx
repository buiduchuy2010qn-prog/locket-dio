import React from "react";
import { FileText } from "lucide-react";
import { useMomentDraftStore, usePostStore } from "@/stores";

/**
 * Badge-only entry to draft library — never auto-opens modal.
 * Visible when studio is empty and ≥1 draft exists.
 */
export default function DraftButton() {
  const draftCount = useMomentDraftStore((s) => s.draftCount);
  const hasDraft = useMomentDraftStore((s) => s.hasDraft);
  const openLibrary = useMomentDraftStore((s) => s.openLibrary);
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);

  const studioEmpty = !selectedFile && !preview?.data;
  if ((!hasDraft && draftCount < 1) || !studioEmpty) return null;

  const count = draftCount || (hasDraft ? 1 : 0);
  const label = `Bản nháp · ${count}`;

  return (
    <button
      type="button"
      className="pillSideBtn"
      onClick={() => {
        // openLibrary: local list first, then GET cloud + merge when online
        void openLibrary();
      }}
      aria-label={label}
      title={label}
    >
      <span className="relative inline-flex flex-col items-center gap-0.5">
        <FileText size={22} strokeWidth={2} />
        <span
          className="text-[9px] font-bold leading-none whitespace-nowrap px-1 py-0.5 rounded-full bg-amber-400 text-black max-w-[4.75rem] truncate"
          aria-hidden
        >
          {label}
        </span>
      </span>
    </button>
  );
}
