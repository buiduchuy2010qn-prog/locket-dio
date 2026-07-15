import React from "react";
import { FREE_FOR_ALL } from "@/hooks/useFeature";

/**
 * Gate UI — FREE_FOR_ALL: luôn mở, không chặn.
 */
export default function FeatureGate({
  canUse,
  children,
  message = "Tính năng yêu cầu nâng cấp gói",
}) {
  const allowed = FREE_FOR_ALL || Boolean(canUse);

  return (
    <div className={`relative ${allowed ? "" : "pointer-events-none"}`}>
      {children}

      {!allowed && (
        <div className="absolute inset-0 z-10 bg-base-100/20 backdrop-blur-[1px] rounded-lg flex items-center justify-center">
          <div className="text-center text-sm font-semibold text-error px-4">
            🚫 {message}
          </div>
        </div>
      )}
    </div>
  );
}
