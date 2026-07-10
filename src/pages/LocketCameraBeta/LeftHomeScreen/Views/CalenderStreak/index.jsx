import React, { lazy } from "react";
import { useTranslation } from "react-i18next";
const StreaksCalender = lazy(() => import("./StreaksCalender"));
import BottomStreak from "./BottomStreak";

function StreakLocket({ recentPosts }) {
  const { t } = useTranslation("main");

  return (
    <>
      <div className="p-4 w-full flex flex-col gap-4">
        <p>{t("left.calendar_note_1")}</p>

        <p>{t("left.calendar_note_2")}</p>

        <p className="mb-6">{t("left.calendar_note_3")}</p>

        <StreaksCalender recentPosts={recentPosts} />
        <BottomStreak recentPosts={recentPosts} />
      </div>
    </>
  );
}

export default StreakLocket;
