import { Flame, Heart } from "lucide-react";
import { useStreakStore } from "@/stores";
import { useTranslation } from "react-i18next";

export default function BottomStreak({ recentPosts = [] }) {
  const streak = useStreakStore((s) => s.streak);
  const { t } = useTranslation("main");

  return (
    <div className="w-full flex justify-center items-center pb-24">
      <div className="flex items-center gap-4 bg-base-300 px-6 py-2.5 rounded-3xl backdrop-blur-sm font-semibold">
        <span className="flex items-center gap-1">
          <Heart className="w-5 h-5" color="orange" strokeWidth={3} />
          {t("left.lockets_count", { count: recentPosts.length || "???" })}
        </span>

        <div className="w-[2px] h-4 bg-black rounded-sm" />

        <span className="flex items-center gap-1">
          <Flame className="w-5 h-5" color="orange" strokeWidth={3} />
          {t("left.streak_days", { count: streak?.count || "0" })}
        </span>
      </div>
    </div>
  );
}
