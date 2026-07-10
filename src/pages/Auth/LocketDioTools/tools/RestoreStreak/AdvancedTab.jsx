import React from "react";
import { Link } from "react-router-dom";
import { InfoBlock, WarningBlock } from "./WarningBlock";

export default function AdvancedTab({
  streak,
  currentDate,
  previousDate,
  suggestedPastDate,
  suggestedCurrentDate,
  suggestType,
  setSuggestType,
  restoreStreakDate,
  isTodayStreak,
  confirmDeletedToday,
  setConfirmDeletedToday,
  isCurrentDate,
  isFutureDate,
  effectiveCanRestore,
  formatToDDMMYYYY,
}) {
  return (
    <div className="space-y-3">
      {/* STREAK INFO */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
        <div
          data-tour="current-streak"
          className="p-3 border border-base-300 rounded-xl bg-base-200 shadow-sm"
        >
          <h3 className="font-semibold mb-2">🔥 Hiện tại</h3>
          <div className="space-y-1 text-sm">
            <p>
              <b>Số ngày:</b> {streak.count ?? 0}
            </p>
            <p>
              <b>Cập nhật gần nhất:</b>{" "}
              {formatToDDMMYYYY(streak.last_updated_yyyymmdd)}
            </p>
          </div>
        </div>

        <div
          data-tour="past-streak"
          className="p-3 border border-base-300 rounded-xl bg-base-200 shadow-sm"
        >
          <h3 className="font-semibold mb-2">🕒 Quá khứ</h3>
          <div className="space-y-1 text-sm">
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

      {/* MODE SELECT */}
      <div className="p-4 border rounded-xl bg-base-200 space-y-4">
        <h3 className="font-semibold text-lg mb-3">📅 Ngày liên quan</h3>
        <div className="space-y-2 text-sm">
          <p data-tour="current-day">
            <b>Hôm nay:</b> {formatToDDMMYYYY(currentDate)}
          </p>
          <p data-tour="past-day">
            <b>Ngày trước đó:</b> {formatToDDMMYYYY(previousDate)}
          </p>
          {(suggestedPastDate || suggestedCurrentDate) && (
            <InfoBlock title="⚠️ Ngày khôi phục đề xuất">
              <div className="space-y-3 text-sm">
                {suggestedPastDate && (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="suggest_type"
                      className="radio radio-info radio-sm mt-1"
                      checked={suggestType === "past"}
                      onChange={() => setSuggestType("past")}
                    />
                    <div>
                      <p className="font-medium">Khôi phục chuỗi quá khứ</p>
                      <p className="opacity-70">
                        Dựa trên chuỗi trước đó đã kết thúc
                      </p>
                      <div className="mt-1 bg-base-300 p-2 rounded-lg font-mono text-center">
                        {formatToDDMMYYYY(suggestedPastDate)}
                      </div>
                    </div>
                  </label>
                )}

                {suggestedCurrentDate && (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="suggest_type"
                      className="radio radio-info radio-sm mt-1"
                      checked={suggestType === "current"}
                      onChange={() => setSuggestType("current")}
                    />
                    <div>
                      <p className="font-medium">
                        Khôi phục chuỗi hiện tại + 1
                      </p>
                      <p className="opacity-70">Tiếp nối từ chuỗi đang có</p>
                      <div className="mt-1 bg-base-300 p-2 rounded-lg font-mono text-center">
                        {formatToDDMMYYYY(suggestedCurrentDate)}
                      </div>
                    </div>
                  </label>
                )}
              </div>
            </InfoBlock>
          )}
        </div>

        <div className="mt-5 p-3 bg-base-100 rounded-lg border text-base">
          <p className="opacity-70">
            📦 Giá trị <b>restoreStreakDate</b> được chọn:
          </p>
          <code data-tour="day-value" className="text-primary font-mono">
            {formatToDDMMYYYY(restoreStreakDate)}
          </code>
        </div>

        {isTodayStreak && (
          <WarningBlock title="⚠️ Chuỗi đã đúng ngày hiện tại">
            <p className="text-sm opacity-80">
              Chuỗi của bạn đã được cập nhật cho <b>ngày hôm nay</b>.
            </p>

            <p className="text-sm opacity-80 mt-2">
              Việc tiếp tục khôi phục trong trường hợp này có thể làm{" "}
              <b>sai lệch dữ liệu chuỗi</b>.
            </p>

            <p className="text-sm opacity-80 mt-2">
              Nếu bạn chắc chắn muốn khôi phục, hãy đảm bảo rằng{" "}
              <b>tất cả bài đăng của ngày hôm nay đã được xoá</b>.
            </p>
          </WarningBlock>
        )}
        <WarningBlock title="❗Bật chế độ khôi phục nâng cao?">
          <p className="text-sm opacity-80">
            Bạn vẫn có thể bật chế độ này để cập nhật lại chuỗi vào{" "}
            <b>ngày trước đó và trước đó nữa</b>.
          </p>
          <p className="text-sm opacity-80 mt-2">
            Tôi xác nhận rằng <b>đã xoá toàn bộ bài đăng của ngày hôm nay</b> và
            hiểu rằng việc khôi phục chuỗi có thể làm sai lệch dữ liệu nếu thông
            tin này không chính xác.
          </p>
          <label className="flex items-center justify-start gap-2 cursor-pointer text-sm mt-2">
            <input
              type="checkbox"
              className="checkbox checkbox-warning checkbox-sm"
              checked={confirmDeletedToday}
              onChange={(e) => setConfirmDeletedToday(e.target.checked)}
            />
            <span className="opacity-80">
              Tôi đồng ý và chấp nhận điều kiện
            </span>
          </label>
        </WarningBlock>

        {isCurrentDate && (
          <WarningBlock title="⚠️ Bạn đang chọn ngày hiện tại">
            <p className="text-2xl font-semibold">
              Khôi phục cho ngày hiện tại?! Thật là điên dồ hãy chắc những gì
              bạn đang làm!
            </p>
            <p className="text-sm opacity-80 mt-2">
              Ngày bạn chọn (<b>{formatToDDMMYYYY(restoreStreakDate)}</b>) bằng
              ngày hiện tại (<b>{formatToDDMMYYYY(currentDate)}</b>).
            </p>
          </WarningBlock>
        )}

        {isFutureDate && (
          <WarningBlock title="⚠️ Bạn đang chọn ngày tương lai">
            <p className="text-2xl font-semibold">
              Cái đéo gì tại sao chọn ngày tương lai? Nếu hiểu vấn đề thì đăng
              tiếp còn không hiểu thì dừng lại. Vui lòng đọc hiểu lại hướng dẫn
              chứ đéo phải quen tay skip đâu!
            </p>
            <p className="text-sm opacity-80">
              Ngày bạn chọn (<b>{formatToDDMMYYYY(restoreStreakDate)}</b>) lớn
              hơn ngày hiện tại (<b>{formatToDDMMYYYY(currentDate)}</b>).
            </p>

            <p className="text-sm opacity-80 mt-2">
              Việc khôi phục chuỗi với ngày trong tương lai có thể gây{" "}
              <b>sai lệch dữ liệu</b> hoặc không được hệ thống chấp nhận.
            </p>
          </WarningBlock>
        )}
      </div>

      {/* CONDITIONS */}
      <div
        data-tour="note-streak"
        className="p-5 border border-dashed rounded-xl bg-base-100 space-y-3"
      >
        <h3 className="font-semibold text-lg">⚙️ Điều kiện & hướng dẫn</h3>
        <ul className="list-disc list-inside text-sm space-y-2 opacity-80">
          <li>
            <b>Chế độ khôi phục chuỗi</b>: Chỉ khả dụng nếu bạn{" "}
            <u>chưa đăng bất kỳ bài nào hôm nay</u>. Nếu đã đăng, hãy xóa hết
            bài của ngày hiện tại trước khi thực hiện.
          </li>
          <li>
            <b>Mô tả hoạt động</b>: Khi bật chế độ này, hệ thống sẽ tính bài
            đăng ở <u>ngày hôm qua</u> hoặc ngày gợi ý như một bài đăng hợp lệ
            để khôi phục chuỗi.
          </li>
          <li>
            <b>Chuỗi mới 1,2,3 ngày có khôi phục được không?</b> Được, nhưng
            chỉ tính tới chuỗi 2 nếu chuỗi mới là 3 trở lên thì không thể khôi phục được
            nữa.
          </li>
          <li>
            <b>Đã đăng bài khôi phục thành công nhưng không hiện chuỗi?</b> Sau
            khi khôi phục thành công thì chỉ cần đợi app tải dữ liệu chuỗi hoặc
            đăng ảnh để app cập nhật ngay nhé.
          </li>
          <li>
            <b>Cần hỗ trợ?</b> Chuỗi có thể khôi phục vô hạn số lần chỉ với điều
            kiện thực hiện đúng cách, nếu đã đăng bài hiện lên chuỗi 1 hoặc 2
            thì hãy liên hệ quản trị viên để được giúp đỡ.
          </li>
        </ul>
      </div>

      {/* ACTION */}
      <div className="flex justify-end">
        <Link
          data-tour="restore-btn"
          className={`btn btn-primary ${
            !effectiveCanRestore
              ? "btn-disabled opacity-50 cursor-not-allowed"
              : ""
          }`}
          to={!effectiveCanRestore ? "#" : "/restore-streak"}
        >
          🚀 Chuyển tới trang đăng bài khôi phục
        </Link>
      </div>
    </div>
  );
}
