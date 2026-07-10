import React from "react";
import { Link } from "react-router-dom";
import { WarningBlock } from "./WarningBlock";

export default function BasicTab({
  streak,
  currentDate,
  previousDate,
  formatToDDMMYYYY,
  isTodayStreak,
}) {
  return (
    <div className="space-y-4">
      {/* STREAK INFO (Basic - Streak) */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
        <div className="p-3 border border-base-300 rounded-xl bg-base-200 shadow-sm">
          <h3 className="font-semibold mb-2">🔥 Hiện tại</h3>
          <div className="space-y-1 text-md">
            <p>
              <b>Số ngày:</b> {streak.count ?? 0}
            </p>
            <p>
              <b>Cập nhật gần nhất:</b>{" "}
              {formatToDDMMYYYY(streak.last_updated_yyyymmdd)}
            </p>
          </div>
        </div>

        <div className="p-3 border border-base-300 rounded-xl bg-base-200 shadow-sm">
          <h3 className="font-semibold mb-2">🕒 Quá khứ</h3>
          <div className="space-y-1 text-md">
            <p>
              <b>Số ngày:</b> {streak.past_streak?.count ?? 0}
            </p>
            <p>
              <b>Kết thúc vào:</b>{" "}
              {formatToDDMMYYYY(streak.past_streak?.last_updated_yyyymmdd)}
            </p>
          </div>
        </div>
      </div>

      {/* Simple info block indicating target date is yesterday */}
      <div className="p-4 border border-base-300 rounded-xl bg-base-200">
        <h3 className="font-semibold text-lg mb-2">📅 Thông tin khôi phục</h3>

        <div className="text-md mb-3">
          Hệ thống sẽ tạo bài đăng khôi phục cho ngày{" "}
          <span className="font-semibold text-primary">
            {formatToDDMMYYYY(previousDate)}
          </span>
          .
        </div>

        <div className="flex items-center gap-3">
          {/* Ngày khôi phục */}
          <div className="flex-1 rounded-xl border border-primary/30 bg-primary/10 p-3 text-center">
            <div className="text-md font-semibold mb-1">Ngày khôi phục</div>
            <div className="font-bold text-primary text-lg">
              {formatToDDMMYYYY(previousDate)}
            </div>
          </div>

          {/* Hôm nay */}
          <div className="flex-1 rounded-xl border border-success/30 bg-success/10 p-3 text-center">
            <div className="text-md font-semibold mb-1">Hôm nay</div>
            <div className="font-bold text-success text-lg">
              {formatToDDMMYYYY(currentDate)}
            </div>
          </div>
        </div>
      </div>
      {isTodayStreak && (
        <WarningBlock title="⚠️ Chuỗi đã đúng ngày hiện tại">
          <p className="text-sm opacity-80">
            Chuỗi của bạn đã được cập nhật cho <b>ngày hôm nay</b>.
          </p>
          <p className="text-sm opacity-80 mt-2">
            Nếu app gốc chưa hiển thị chuỗi đừng lo lắng vì thường trong ngày
            hoặc qua ngày mới hoặc khi đăng ảnh thì chuỗi sẽ hiện lại.
          </p>
        </WarningBlock>
      )}
      {/* ACTION */}
      <div className="flex justify-end">
        <Link
          data-tour="restore-btn"
          className={`btn btn-primary ${
            isTodayStreak ? "btn-disabled opacity-50 cursor-not-allowed" : ""
          }`}
          to={isTodayStreak ? "#" : "/restore-streak"}
        >
          {isTodayStreak
            ? "Không thể tiếp tục"
            : "🚀 Chuyển tới trang đăng bài khôi phục"}
        </Link>
      </div>
    </div>
  );
}
