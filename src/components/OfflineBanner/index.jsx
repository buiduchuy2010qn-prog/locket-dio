import React from "react";
import { useConnectivityStore } from "@/stores/useConnectivityStore";

/**
 * Small non-layout-shifting offline strip.
 * Does not redesign camera UI — fixed top toast-like bar.
 */
export default function OfflineBanner() {
  const isOffline = useConnectivityStore((s) => s.isOffline);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[9998] pointer-events-none flex justify-center pt-safe"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div
        className="pointer-events-none mt-2 mx-3 px-3 py-1.5 rounded-full text-xs font-medium shadow-md"
        style={{
          background: "rgba(28,28,30,0.88)",
          color: "#f5f5f7",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        Đang ngoại tuyến · Bản nháp vẫn được lưu
      </div>
    </div>
  );
}
