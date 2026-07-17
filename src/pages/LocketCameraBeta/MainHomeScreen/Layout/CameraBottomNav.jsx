import React from "react";
import { CalendarHeart, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMomentActivityStore, useSelectedStore } from "@/stores";

/**
 * Bottom nav for camera screen — calendar | home | chat
 * Theme tokens only (no hard-coded black).
 */
export default function CameraBottomNav({
  active = "home",
  setIsBottomOpen,
  setIsProfileOpen,
  setIsHomeOpen,
}) {
  const { t } = useTranslation("main");
  const setSelectedMoment = useSelectedStore((s) => s.setSelectedMoment);
  const setSelectedQueue = useSelectedStore((s) => s.setSelectedQueue);
  const setSelectedMomentId = useSelectedStore((s) => s.setSelectedMomentId);
  const setSelectedQueueId = useSelectedStore((s) => s.setSelectedQueueId);
  const clearActivity = useMomentActivityStore((s) => s.clearActive);

  const resetSelection = () => {
    setSelectedMoment(null);
    setSelectedQueue(null);
    setSelectedMomentId(null);
    setSelectedQueueId(null);
    clearActivity();
  };

  const goHome = () => {
    resetSelection();
    setIsBottomOpen?.(false);
  };

  const goCalendar = () => {
    resetSelection();
    setIsBottomOpen?.(false);
    setIsProfileOpen?.(true);
  };

  const goChat = () => {
    resetSelection();
    setIsBottomOpen?.(false);
    setIsHomeOpen?.(true);
  };

  return (
    <nav className="cameraBottomNav" aria-label="Main">
      <button
        type="button"
        className={`cameraBottomNavBtn ${active === "calendar" ? "is-active" : ""}`}
        onClick={goCalendar}
        aria-label={t("bottom.open_calendar", { defaultValue: "Lịch" })}
      >
        <CalendarHeart size={24} strokeWidth={2} />
      </button>

      <button
        type="button"
        className={`cameraBottomNavBtn ${active === "home" ? "is-active" : ""}`}
        onClick={goHome}
        aria-label={t("bottom.home", { defaultValue: "Camera" })}
        aria-current={active === "home" ? "page" : undefined}
      >
        <span className="cameraBottomNavHomeDot" aria-hidden />
      </button>

      <button
        type="button"
        className={`cameraBottomNavBtn ${active === "chat" ? "is-active" : ""}`}
        onClick={goChat}
        aria-label={t("bottom.chat", { defaultValue: "Chat" })}
      >
        <MessageCircle size={24} strokeWidth={2} />
      </button>
    </nav>
  );
}
