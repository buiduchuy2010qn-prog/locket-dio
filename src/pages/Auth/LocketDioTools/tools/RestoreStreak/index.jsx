import React, { useState, useMemo, useEffect } from "react";
import LoadingRing from "@/components/ui/Loading/ring";
import { useFeatureVisible } from "@/hooks/useFeature";
import { formatYYYYMMDD, addDaysToYYYYMMDD, formatToDDMMYYYY } from "@/utils"; // addDaysToYYYYMMDD là helper tăng ngày
import { usePostStore, useStreakStore } from "@/stores";
import ReviewFeature from "./ReviewFeature";
import LockedPremiumFeature from "../../Layout/LockedPremiumFeature";
import BasicTab from "./BasicTab";
import AdvancedTab from "./AdvancedTab";
import clsx from "clsx";
// import { RenewStreak } from "./RenewStreak";

export default function RestoreStreak() {
  const hasAccess = useFeatureVisible("restore_streak_tool");
  const hasAdvancedAccess = useFeatureVisible("restore_streak_advanced");
  const [confirmDeletedToday, setConfirmDeletedToday] = useState(false);

  const streak = useStreakStore((s) => s.streak);

  const restoreStreakData = usePostStore((s) => s.restoreStreakData);
  const setRestoreStreakData = usePostStore((s) => s.setRestoreStreakData);
  const [mode, setMode] = useState("restore"); // "restore" | "continue"
  const [suggestType, setSuggestType] = useState(null);
  const [subTab, setSubTab] = useState("basic"); // "basic" | "advanced"

  const suggestedPastDate = useMemo(() => {
    if (!streak?.past_streak?.last_updated_yyyymmdd) return null;
    return addDaysToYYYYMMDD(streak.past_streak.last_updated_yyyymmdd, 1);
  }, [streak]);

  const suggestedCurrentDate = useMemo(() => {
    if (!streak?.last_updated_yyyymmdd) return null;
    return addDaysToYYYYMMDD(streak.last_updated_yyyymmdd, 1);
  }, [streak]);

  const currentDate = useMemo(() => formatYYYYMMDD(), []);
  const previousDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatYYYYMMDD(d);
  }, []);

  useEffect(() => {
    if (suggestedPastDate && !suggestedCurrentDate) {
      setSuggestType("past");
    } else if (!suggestedPastDate && suggestedCurrentDate) {
      setSuggestType("current");
    }
  }, [suggestedPastDate, suggestedCurrentDate]);

  const restoreStreakDate = useMemo(() => {
    if (suggestType === "past" && suggestedPastDate) return suggestedPastDate;

    if (suggestType === "current" && suggestedCurrentDate)
      return suggestedCurrentDate;

    return mode === "restore" ? previousDate : currentDate;
  }, [
    suggestType,
    suggestedPastDate,
    suggestedCurrentDate,
    mode,
    previousDate,
    currentDate,
  ]);

  // ✅ Xác định xem chuỗi hôm nay đã cập nhật chưa
  const isTodayStreak = streak?.last_updated_yyyymmdd === currentDate;

  const streakUpdated = streak?.last_updated_yyyymmdd === previousDate;

  const isFutureDate = restoreStreakDate > currentDate;
  const isCurrentDate = String(restoreStreakDate) === String(currentDate);
  // Chỉ cho khôi phục khi:
  // - Chuỗi chưa tới hôm nay
  // - Hoặc user xác nhận đã xoá bài hôm nay
  const canRestore = confirmDeletedToday || (!streakUpdated && !isTodayStreak);

  const effectiveRestoreStreakDate =
    subTab === "basic" ? previousDate : restoreStreakDate;
  const effectiveMode = subTab === "basic" ? "restore" : mode;
  const effectiveCanRestore = subTab === "basic" ? true : canRestore;

  useEffect(() => {
    setConfirmDeletedToday(false);
  }, [isTodayStreak]);

  useEffect(() => {
    setRestoreStreakData({
      data: effectiveRestoreStreakDate,
      mode: effectiveMode,
      name:
        effectiveMode === "restore"
          ? "Chế độ khôi phục chuỗi"
          : "Chế độ nối tiếp chuỗi",
    });
  }, [effectiveMode, effectiveRestoreStreakDate, setRestoreStreakData]);

  // useEffect(() => {
  //   console.log({
  //     restoreStreakDate,
  //     currentDate,
  //     previousDate,
  //     isCurrentDate,
  //     isFutureDate,
  //   });
  // }, [restoreStreakDate, currentDate]);

  if (!streak) {
    return (
      <div className="flex justify-center items-center h-48">
        <LoadingRing />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div data-tour="introduce-streak">
        <h2 className="text-2xl font-semibold">🔥 Khôi phục chuỗi (Streak)</h2>

        <div className="mt-3">
          <p className="text-sm text-base-content/70 mb-2">
            👇 Ấn để xem thêm hướng dẫn hoặc tham gia cộng đồng hỗ trợ
          </p>

          <div className="flex flex-wrap gap-2">
            <a
              href={
                "https://glory-silicon-841.notion.site/H-ng-d-n-Kh-i-ph-c-chu-i-3864e4ef30a6806c84aaf0fe909df742"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-info"
            >
              📖 Hướng dẫn
            </a>

            <a
              href={"https://m.me/cm/AbYPtgRiGe2fInEf"}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-primary"
            >
              👥 Messenger
            </a>

            <a
              href={"https://discord.gg/47buy9nMGc"}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-secondary"
            >
              💬 Discord
            </a>

            <a
              href={"https://t.me/nthuylocket"}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-accent"
            >
              🚀 Telegram
            </a>
          </div>
        </div>
        {/* TABS */}
        <div className="flex border-b border-base-300 mt-4">
          <button
            className={clsx(
              "flex-1 py-2 text-center font-medium border-b-2 transition-all",
              {
                "border-primary text-primary font-bold": subTab === "basic",
                "border-transparent text-base-content/70 hover:text-base-content":
                  subTab !== "basic",
              },
            )}
            onClick={() => setSubTab("basic")}
          >
            Cơ bản
          </button>

          <button
            className={clsx(
              "flex-1 py-2 text-center font-medium border-b-2 transition-all",
              {
                "border-primary text-primary font-bold": subTab === "advanced",
                "border-transparent text-base-content/70 hover:text-base-content":
                  subTab !== "advanced",
              },
            )}
            onClick={() => setSubTab("advanced")}
          >
            Nâng cao
          </button>
        </div>

        {/* DESCRIPTION */}
        <p className="text-sm opacity-70 mt-4 max-w-2xl">
          {subTab === "basic"
            ? "Chế độ cơ bản này giúp bạn khôi phục chuỗi bằng cách đăng bài một cách nhanh chóng với các thiết lập mặc định."
            : "Chế độ nâng cao cho phép tùy chỉnh ngày khôi phục streak và xử lý các trường hợp đặc biệt."}
        </p>
        <p className="text-sm text-base-content/70 mb-2">
          Nếu chuỗi mới đã lên 1,2 hãy liên hệ trên các cộng đồng để được giúp
          đỡ bởi vẫn có khả năng khôi phục.
        </p>
      </div>

      {/* GUIDE ADVANCED */}
      {subTab === "advanced" && (
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body p-4">
            <h3 className="font-semibold">
              📚 Hướng dẫn sử dụng chế độ nâng cao
            </h3>

            <p className="text-sm opacity-70">
              Nếu bạn chưa từng sử dụng tính năng này, hãy xem hướng dẫn trước
              khi thực hiện để tránh chọn sai ngày khôi phục.
            </p>

            <ReviewFeature />
          </div>
        </div>
      )}

      {/* CONTENT */}
      {subTab === "basic" ? (
        <BasicTab
          streak={streak}
          currentDate={currentDate}
          previousDate={previousDate}
          formatToDDMMYYYY={formatToDDMMYYYY}
          isTodayStreak={isTodayStreak}
        />
      ) : hasAdvancedAccess ? (
        <AdvancedTab
          streak={streak}
          currentDate={currentDate}
          previousDate={previousDate}
          suggestedPastDate={suggestedPastDate}
          suggestedCurrentDate={suggestedCurrentDate}
          suggestType={suggestType}
          setSuggestType={setSuggestType}
          restoreStreakDate={restoreStreakDate}
          isTodayStreak={isTodayStreak}
          confirmDeletedToday={confirmDeletedToday}
          setConfirmDeletedToday={setConfirmDeletedToday}
          isCurrentDate={isCurrentDate}
          isFutureDate={isFutureDate}
          effectiveCanRestore={effectiveCanRestore}
          formatToDDMMYYYY={formatToDDMMYYYY}
        />
      ) : (
        <LockedPremiumFeature />
      )}
    </div>
  );
}
