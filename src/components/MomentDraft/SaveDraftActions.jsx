import React, { useState } from "react";
import { useMomentDraftStore, usePostStore } from "@/stores";
import { useConnectivityStore } from "@/stores/useConnectivityStore";

/**
 * Compact actions after capture — does not move camera chrome.
 * Đăng ngay | Lưu bản nháp | Lưu và chụp tiếp
 */
export default function SaveDraftActions() {
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);
  const hasMedia = !!(selectedFile || preview?.data);
  const isOffline = useConnectivityStore((s) => s.isOffline);
  const serverReachable = useConnectivityStore((s) => s.serverReachable);
  const saveCurrentAsDraft = useMomentDraftStore((s) => s.saveCurrentAsDraft);
  const openLibrary = useMomentDraftStore((s) => s.openLibrary);
  const [busy, setBusy] = useState(false);

  if (!hasMedia) return null;

  const canPost = !isOffline && serverReachable;

  const onSave = async (clearAfter) => {
    if (busy) return;
    setBusy(true);
    try {
      await saveCurrentAsDraft({ clearAfter });
      if (clearAfter) {
        // stay on camera for next shot
      }
    } finally {
      setBusy(false);
    }
  };

  const onSaveOpenLibrary = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveCurrentAsDraft({ clearAfter: true });
      openLibrary();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="w-full flex justify-center px-3 mb-1"
      data-save-draft-actions="true"
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-md">
        <button
          type="button"
          disabled={!canPost || busy}
          className="btn btn-xs btn-primary rounded-full disabled:opacity-40"
          title={
            canPost
              ? "Dùng nút đăng ở giữa để đăng ngay"
              : "Đang ngoại tuyến — không thể đăng ngay"
          }
          onClick={() => {
            // Focus existing send button — keep one post path
            const btn = document.querySelector('[data-send-button="true"]');
            if (btn && !btn.disabled) btn.click();
          }}
        >
          Đăng ngay
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn btn-xs btn-ghost bg-base-200 rounded-full"
          onClick={onSaveOpenLibrary}
        >
          Lưu bản nháp
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn btn-xs btn-ghost bg-base-200 rounded-full"
          onClick={() => onSave(true)}
        >
          Lưu và chụp tiếp
        </button>
      </div>
    </div>
  );
}
