import React, { useEffect, useState } from "react";
import {
  subscribeAppUpdate,
  userForceUpdate,
  checkForAppUpdate,
} from "@/utils/pwaUtils/updateWatcher";
import { RefreshCw } from "lucide-react";

/**
 * Nút tròn cập nhật — luôn hiện cạnh avatar hồ sơ.
 * - Bấm: xóa cache + tải bản mới nhất
 * - Chấm hồng: có bản mới hơn trên server
 * (Tự cập nhật khi thoát/vào lại web — xem updateWatcher.autoUpdateIfAvailable)
 */
export default function AppUpdateButton({ className = "" }) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkForAppUpdate().catch(() => {});
    return subscribeAppUpdate((state) => {
      setHasUpdate(Boolean(state?.available));
    });
  }, []);

  const onClick = async (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    if (loading) return;
    setLoading(true);
    try {
      await userForceUpdate();
      // Nếu reload không chạy (đã latest + guard), tắt loading
      setTimeout(() => setLoading(false), 4000);
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
      title={
        hasUpdate
          ? "Có bản mới — bấm để cập nhật"
          : "Làm mới / cập nhật app"
      }
      data-update-button="true"
      className={`relative flex items-center justify-center w-11 h-11
        rounded-full bg-base-300/70 backdrop-blur-[4px]
        hover:bg-base-300 active:scale-105 transition
        disabled:opacity-70 disabled:cursor-wait shrink-0
        ${className}`}
    >
      {hasUpdate && !loading ? (
        <span
          className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-pink-500 border-2 border-base-100 animate-pulse"
          aria-hidden
        />
      ) : null}
      <RefreshCw
        size={22}
        strokeWidth={2.2}
        className={loading ? "animate-spin" : ""}
        aria-hidden
      />
    </button>
  );
}
