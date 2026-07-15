import React from "react";

/**
 * Legacy premium lock UI — Huy Locket free-for-all: không khóa nữa.
 * Component giữ export để không vỡ import; hiển thị thông báo miễn phí.
 */
export default function LockedPremiumFeature() {
  return (
    <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-center flex flex-col items-center gap-3">
      <div className="text-5xl">✨</div>
      <h3 className="text-xl font-semibold text-base-content">
        Huy Locket miễn phí
      </h3>
      <p className="text-sm text-base-content/70">
        Mọi tính năng đã mở cho tất cả mọi người — không cần đăng ký gói.
      </p>
    </div>
  );
}
