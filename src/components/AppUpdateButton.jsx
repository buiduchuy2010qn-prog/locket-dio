import React, { useEffect, useState } from "react";
import {
  subscribeAppUpdate,
  applyWebsiteUpdate,
  checkForAppUpdate,
} from "@/utils/pwaUtils/updateWatcher";
import { RefreshCw } from "lucide-react";

/**
 * Nút tròn "Cập nhật" — chỉ hiện khi có bản mới.
 * Đặt cạnh avatar hồ sơ (HeaderHome).
 */
export default function AppUpdateButton({ className = "" }) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return subscribeAppUpdate((state) => {
      setAvailable(Boolean(state?.available));
    });
  }, []);

  if (!available) return null;

  const onClick = async (e) => {
    e?.stopPropagation?.();
    if (loading) return;
    setLoading(true);
    try {
      await checkForAppUpdate();
      await applyWebsiteUpdate();
    } catch (err) {
      console.error("[AppUpdateButton]", err);
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
      data-update-button="true"
      className={`relative flex items-center justify-center w-11 h-11
        rounded-full bg-base-300/70 backdrop-blur-[4px]
        hover:bg-base-300 active:scale-105 transition
        disabled:opacity-70 disabled:cursor-wait shrink-0
        ${className}`}
    >
      {/* chấm đỏ báo có update */}
      {!loading && (
        <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-pink-500 border-2 border-base-100" />
      )}
      <RefreshCw
        size={22}
        strokeWidth={2.2}
        className={loading ? "animate-spin" : ""}
        aria-hidden
      />
    </button>
  );
}
