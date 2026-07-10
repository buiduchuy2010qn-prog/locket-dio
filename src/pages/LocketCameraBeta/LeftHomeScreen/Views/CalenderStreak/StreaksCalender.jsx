import React, { useMemo, useRef, useEffect } from "react";
import { useStreakStore } from "@/stores";
import MonthCalendar from "./MonthCalendar";
import {
  getMonthKeyFromCustomDate,
  getStreakRange,
  getCurrentRecoverWindow,
  getPastRecoverWindow,
} from "./streakUtils";
import { useTranslation } from "react-i18next";

const StreaksCalender = ({ recentPosts = [], setIsProfileOpen }) => {
  const { t } = useTranslation("main");
  // Read actual streak from the store with a safety fallback of null
  const streak = useStreakStore((s) => s.streak) || null;

  // Precompute reference date (today at midnight)
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Precompute ranges and recovery windows
  const currentStreak = useMemo(() => getStreakRange(streak), [streak]);
  const pastStreak = useMemo(() => {
    const range = getStreakRange(streak?.past_streak);
    if (range && range.end.getTime() >= today.getTime()) {
      return null;
    }
    return range;
  }, [streak, today]);

  const currentRecoverWindow = useMemo(
    () => getCurrentRecoverWindow(currentStreak, today),
    [currentStreak, today]
  );
  const pastRecoverWindow = useMemo(
    () => getPastRecoverWindow(pastStreak, currentStreak, today),
    [pastStreak, currentStreak, today]
  );

  // Group posts by month
  const postsByMonth = useMemo(() => {
    const map = {};

    recentPosts.forEach((post) => {
      if (!post?.createdAt) return;

      const monthKey = getMonthKeyFromCustomDate(post.createdAt);

      if (!map[monthKey]) map[monthKey] = [];

      map[monthKey].push(post);
    });

    // luôn thêm tháng hiện tại
    const currentMonthKey = getMonthKeyFromCustomDate(new Date());

    if (!map[currentMonthKey]) {
      map[currentMonthKey] = [];
    }

    return map;
  }, [recentPosts]);

  // Sort months chronologically
  const monthsSorted = useMemo(() => {
    return Object.keys(postsByMonth).sort();
  }, [postsByMonth]);

  const lastMonthRef = useRef(null);

  // Smooth scroll to the most recent month
  useEffect(() => {
    if (lastMonthRef.current) {
      const timer = setTimeout(() => {
        lastMonthRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [monthsSorted]);

  // if (recentPosts.length === 0) {
  //   return (
  //     <div className="w-full min-h-[200px] flex text-center items-center justify-center text-lg text-base-content/75 font-semibold p-6 bg-base-300 rounded-3xl">
  //       {t("left.activate_calendar_prompt")}
  //     </div>
  //   );
  // }

  return (
    <div className="space-y-6">
      {monthsSorted.map((monthKey, idx) => {
        const isLast = idx === monthsSorted.length - 1;
        return (
          <div key={monthKey} ref={isLast ? lastMonthRef : null}>
            <MonthCalendar
              monthKey={monthKey}
              postsInMonth={postsByMonth[monthKey]}
              streak={streak}
              currentStreak={currentStreak}
              pastStreak={pastStreak}
              currentRecoverWindow={currentRecoverWindow}
              pastRecoverWindow={pastRecoverWindow}
              today={today}
              setIsProfileOpen={setIsProfileOpen}
            />
          </div>
        );
      })}
    </div>
  );
};

export default StreaksCalender;
