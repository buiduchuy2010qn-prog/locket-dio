import { useMomentDraftStore } from "@/stores";

/**
 * Legacy auto-restore modal removed.
 * Drafts are opened only via the "Bản nháp · N" badge → DraftLibrary.
 */
export default function RestoreDraftModal() {
  return null;
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
