import React, { useMemo } from "react";
import CalendarDay from "./CalendarDay";
import { parseCustomDate, getLastDayOfMonth, isSameDay } from "./streakUtils";
import { useTranslation } from "react-i18next";

export default function MonthCalendar({
  monthKey,
  postsInMonth = [],
  streak = null,
  currentStreak = null,
  pastStreak = null,
  currentRecoverWindow = null,
  pastRecoverWindow = null,
  today = new Date(),
}) {
  if (!monthKey) return null;

  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;

  if (isNaN(year) || isNaN(month)) return null;

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month, getLastDayOfMonth(year, month));

  // Group posts by day
  const postsByDate = useMemo(() => {
    const map = {};
    postsInMonth.forEach((post) => {
      const d = parseCustomDate(post?.createdAt);
      if (!d) return;
      const key = `${d.getFullYear()}-${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(post);
    });
    return map;
  }, [postsInMonth]);

  // Generate days array for this month
  const daysArray = useMemo(() => {
    const arr = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      arr.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return arr;
  }, [startDate, endDate]);

  const { i18n } = useTranslation();

  const localeMap = {
    vi: "vi-VN",
    en: "en-US",
    de: "de-DE",
    zh: "zh-CN",
    ko: "ko-KR",
  };

  const locale = localeMap[i18n.language] || "en-US";

  // Month name formatting (e.g., "Tháng 6 năm 2026")
  const monthName = startDate.toLocaleString(locale, {
    month: "long",
    year: "numeric",
  });

  const daysMobile = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const daysDesktop = [
    "CN",
    "T2",
    "T3",
    "T4",
    "T5",
    "T6",
    "T7",
    "CN",
    "T2",
    "T3",
    "T4",
    "T5",
    "T6",
    "T7",
  ];

  return (
    <div className="mb-8 bg-base-300 rounded-3xl shadow-lg overflow-hidden border border-base-content/5">
      <h2 className="text-xl font-bold mb-0 w-full rounded-t-3xl bg-base-100 text-base-content py-3 px-6 shadow-md select-none capitalize">
        {monthName}
      </h2>
      <div className="grid grid-cols-7 md:grid-cols-14 gap-1 md:gap-3 p-3">
        {/* Mobile headers (7 cols) */}
        {daysMobile.map((d) => (
          <div
            key={"mobile-" + d}
            className="block text-center font-semibold text-xs text-base-content/60 border-b border-base-content/10 pb-1 md:hidden select-none"
          >
            {d}
          </div>
        ))}

        {/* Desktop headers (14 cols) */}
        {daysDesktop.map((d, i) => (
          <div
            key={"desktop-" + i}
            className="hidden md:block text-center font-semibold text-xs text-base-content/60 border-b border-base-content/10 pb-1 select-none"
          >
            {d}
          </div>
        ))}

        {/* Offset spaces for the first day of the month */}
        {Array(startDate.getDay())
          .fill(null)
          .map((_, i) => (
            <div key={"empty-" + i} className="aspect-square" />
          ))}

        {/* Calendar days */}
        {daysArray.map((day) => {
          const dayKey = `${day.getFullYear()}-${(day.getMonth() + 1)
            .toString()
            .padStart(2, "0")}-${day.getDate().toString().padStart(2, "0")}`;
          const posts = postsByDate[dayKey] || [];

          // 1. Is day in current streak range?
          const isInCurrentStreak =
            currentStreak &&
            day >= currentStreak.start &&
            day <= currentStreak.end;

          // 2. Is day in past streak range? (Hide past streak on days that overlap with current streak)
          const isInPastStreak =
            pastStreak &&
            day >= pastStreak.start &&
            day <= pastStreak.end &&
            !isInCurrentStreak;

          // 3. Is day today?
          const isToday = isSameDay(day, today);

          // 4. Show plus icon on today if no post and streak exists but not updated today
          const showPlusIcon =
            isToday &&
            (streak === null || (streak.count > 0 && !isInCurrentStreak));

          // 5. Is day in current recovery window?
          const isInCurrentRecover =
            !isInCurrentStreak &&
            !isInPastStreak &&
            currentRecoverWindow &&
            day >= currentRecoverWindow.start &&
            day <= currentRecoverWindow.end;

          // 6. Should show current restore icon?
          const isRestoreCurrentIcon =
            isInCurrentRecover && isSameDay(day, currentRecoverWindow.iconDate);

          // 7. Is day in past recovery window?
          const isInPastRecover =
            !isInCurrentStreak &&
            !isInPastStreak &&
            !isInCurrentRecover &&
            pastRecoverWindow &&
            day >= pastRecoverWindow.start &&
            day <= pastRecoverWindow.end;

          // 8. Should show past restore icon?
          const isRestorePastIcon =
            isInPastRecover && isSameDay(day, pastRecoverWindow.iconDate);

          return (
            <CalendarDay
              key={dayKey}
              day={day}
              posts={posts}
              isInCurrentStreak={isInCurrentStreak}
              isInPastStreak={isInPastStreak}
              isInCurrentRecover={isInCurrentRecover}
              isInPastRecover={isInPastRecover}
              isRestoreCurrentIcon={isRestoreCurrentIcon}
              isRestorePastIcon={isRestorePastIcon}
              currentStreak={currentStreak}
              pastStreak={pastStreak}
              showPlusIcon={showPlusIcon}
            />
          );
        })}
      </div>
    </div>
  );
}
