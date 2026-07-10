import React from "react";
import { Plus } from "lucide-react";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { usePostStore } from "@/stores";
import clsx from "clsx";
import { dateToYYYYMMDD } from "./streakUtils";
import { useApp } from "@/context/AppContext";
import { useTranslation } from "react-i18next";

export default function CalendarDay({
  day,
  posts = [],
  isInCurrentStreak = false,
  isInPastStreak = false,
  isInCurrentRecover = false,
  isInPastRecover = false,
  isRestoreCurrentIcon = false,
  isRestorePastIcon = false,
  currentStreak = null,
  pastStreak = null,
  showPlusIcon = false,
}) {
  const setRestoreStreakData = usePostStore((s) => s.setRestoreStreakData);
  const { setIsProfileOpen } = useApp().navigation;
  const { t } = useTranslation("main");

  if (!day) return null;

  const dayKey = `${day.getFullYear()}-${(day.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${day.getDate().toString().padStart(2, "0")}`;

  const handleRestoreClick = (e) => {
    e.stopPropagation();
    const formattedDate = day.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // Display the sonnerToast
    SonnerInfo(
      t("left.restore_streak_title", { date: formattedDate }),
      t("left.restore_streak_desc"),
    );

    // Set the recovery mode details in store
    setRestoreStreakData({
      data: dateToYYYYMMDD(day),
      mode: "restore",
      name: t("left.restore_streak_mode"),
    });

    // Close profile open state to return to camera home screen
    if (setIsProfileOpen) {
      setIsProfileOpen(false);
    }
  };

  const showRestoreIcon = isRestoreCurrentIcon || isRestorePastIcon;

  return (
    <div
      className={clsx(
        "aspect-square rounded-xl border flex flex-col overflow-hidden cursor-pointer group relative",
        {
          // Current streak highlights
          "border-yellow-400 border-3 bg-base-200": isInCurrentStreak || showPlusIcon,
          // Past streak highlights
          "border-gray-400 border-3 bg-base-200": isInPastStreak,
          // Current recovery dashed border
          "border-yellow-400 border-2 border-dashed bg-base-200/50":
            isInCurrentRecover,
          // Past recovery dashed border
          "border-gray-400 border-2 border-dashed bg-base-200/50":
            isInPastRecover,
          // Normal days with no streak or recovery active
          "border-base-content/10 hover:border-base-content/30":
            !isInCurrentStreak &&
            !isInPastStreak &&
            !isInCurrentRecover &&
            !isInPastRecover &&
            !showPlusIcon,
        },
      )}
      title={
        posts.length > 0
          ? posts[0].createdAt // Original creation time for tooltip
          : dayKey
      }
    >
      {/* Day number */}
      <div
        className={clsx(
          "absolute mt-1 ml-1 z-20 text-[10px] font-semibold mb-1 select-none",
          {
            "text-white drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.8)]":
              posts.length !== 0,
            "text-base-content/70": posts.length === 0,
          },
        )}
      >
        {day.getDate()}
      </div>

      {/* Restore Icon */}
      {showRestoreIcon && (
        <div
          className="absolute z-10 inset-0 flex justify-center items-center select-none bg-amber-500/10 backdrop-blur-[1px] hover:bg-amber-500/20 transition-colors"
          aria-hidden="true"
          onClick={handleRestoreClick}
        >
          <img
            src="https://cdn.locket-dio.com/v1/caption/caption-icon/streak_restore.png"
            alt="Restore Streak"
            className="w-6 h-6 object-contain animate-pulse"
          />
        </div>
      )}

      {/* Plus icon on today if no post and streak is active */}
      {showPlusIcon && (
        <div
          className="absolute z-10 inset-0 flex justify-center items-center text-green-600 select-none bg-amber-50/70 hover:bg-amber-50 transition-colors"
          aria-hidden="true"
          onClick={(e) => {
            e.stopPropagation();
            SonnerInfo(t("left.continue_streak_prompt"));
          }}
        >
          <Plus strokeWidth={4} size={20} />
        </div>
      )}

      {/* Post thumbnail (if any) */}
      {posts.length === 0 ? (
        <div className="flex-1" />
      ) : (
        <div className="flex-1 overflow-hidden">
          {posts.slice(0, 1).map((item, index) => (
            <div
              key={item.id || index + 1}
              className="relative w-full h-full"
              title={item.captions?.[0]?.text || item.date}
            >
              <img
                src={item.thumbnail_url || item.image_url}
                alt={item.captions?.[0]?.text || "Image"}
                className="object-cover w-full h-full"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Current streak number badge at the end of current streak range */}
      {currentStreak && day.getTime() === currentStreak.end.getTime() && (
        <div className="absolute z-10 bg-yellow-400 text-yellow-800 text-[10px] px-1 font-bold bottom-0 right-0 rounded-tl-md">
          {currentStreak.count}
        </div>
      )}

      {/* Past streak number badge at the end of past streak range */}
      {pastStreak && day.getTime() === pastStreak.end.getTime() && (
        <div className="absolute z-10 bg-gray-400 text-black text-[10px] px-1 font-bold bottom-0 right-0 rounded-tl-md">
          {pastStreak.count}
        </div>
      )}
    </div>
  );
}
