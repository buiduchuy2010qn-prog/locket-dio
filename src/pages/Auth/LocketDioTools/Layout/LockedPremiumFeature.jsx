import React from "react";
import { useNavigate } from "react-router-dom";

export default function LockedPremiumFeature() {
  const navigate = useNavigate();

  return (
    <div className="rounded-xl border p-4 text-center flex flex-col items-center gap-3">
      <div className="text-6xl">🔒</div>

      <h3 className="text-xl font-semibold">Tính năng bị khóa</h3>

      <p className="text-sm text-gray-500">
        Đăng ký gói để kích hoạt tính năng này
      </p>

      <button
        onClick={() => navigate("/pricing")}
        className="rounded-lg bg-black px-4 py-2 text-white hover:opacity-90 transition"
      >
        Xem ngay
      </button>
    </div>
  );
}
