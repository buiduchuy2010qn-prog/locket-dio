import React from "react";
import { Link } from "react-router-dom";
import ThemeSelector from "@/components/Theme/ThemeSelector";
import MockupiPhone from "@/components/uikit/MockupiPhone";

const AuthHome = () => {

  return (
    <div className="flex flex-col items-center justify-center py-6 bg-base-200 px-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl w-full items-center">
        <div className="text-center lg:text-left">
          <h1 className="text-4xl font-extrabold leading-tight">
            Chia sẻ khoảnh khắc <br /> với Locket!
          </h1>
          <p className="mt-4 text-lg text-base-content">
            Lưu giữ và chia sẻ những kỷ niệm đáng nhớ của bạn với bạn bè và gia đình.
          </p>
          <Link
            to="/locket"
            className="mt-6 px-6 py-4 rounded-lg shadow btn btn-primary text-lg font-semibold hover:bg-primary-focus transition"
          >
            Khám phá ngay
          </Link>
        </div>
        <div className="flex justify-center disable-select">
          <MockupiPhone/>
        </div>
      </div>

      {/* Section giới thiệu */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl w-full mt-12 mb-7">
        <div className="p-6 bg-base-100 shadow-lg rounded-xl text-center">
          <h2 className="text-xl font-semibold mb-3">📷 Chia sẻ dễ dàng</h2>
          <p className="text-base-content">
            Tải ảnh và video lên chỉ trong vài giây.
          </p>
        </div>
        <div className="p-6 bg-base-100 shadow-lg rounded-xl text-center">
          <h2 className="text-xl font-semibold mb-3">💬 Kết nối bạn bè</h2>
          <p className="text-base-content">
            Xem hoạt động của bạn bè theo thời gian thực.
          </p>
        </div>
        <div className="p-6 bg-base-100 shadow-lg rounded-xl text-center">
          <h2 className="text-xl font-semibold mb-3">🔒 Bảo mật an toàn</h2>
          <p className="text-base-content">
            Dữ liệu của bạn được bảo vệ với công nghệ tiên tiến.
          </p>
        </div>
      </div>

      {/* Import ThemeSelector */}
      <ThemeSelector />
    </div>
  );
};

export default AuthHome;
