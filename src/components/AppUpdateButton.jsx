import React, { useEffect, useState } from "react";
import {
  subscribeAppUpdate,
  applyWebsiteUpdate,
  checkForAppUpdate,
} from "@/utils/pwaUtils/updateWatcher";
import { RefreshCw } from "lucide-react";

/**
 * Small floating "Cập nhật" button — only when a new build / SW is waiting.
 * User taps to update; no auto toast text.
 */
export default function AppUpdateButton() {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return subscribeAppUpdate((state) => {
      setAvailable(Boolean(state?.available));
    });
  }, []);

  if (!available) return null;

  const onClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Re-check then apply
      await checkForAppUpdate();
      await applyWebsiteUpdate();
    } catch (e) {
      console.error("[AppUpdateButton]", e);
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="Cập nhật ứng dụng"
      title="Có bản mới — bấm để cập nhật"
      className="fixed z-[999980] flex items-center gap-1.5 rounded-full
        px-3.5 py-2 text-[13px] font-semibold text-white shadow-lg
        border border-white/20 backdrop-blur-md
        bg-neutral-900/90 hover:bg-neutral-800 active:scale-95
        transition disabled:opacity-70 disabled:cursor-wait
        bottom-[max(1rem,env(safe-area-inset-bottom))] right-4
        md:bottom-auto md:top-[max(1rem,env(safe-area-inset-top))]"
      data-update-button="true"
    >
      <RefreshCw
        className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
        aria-hidden
      />
      {loading ? "Đang cập nhật…" : "Cập nhật"}
    </button>
  );
}
