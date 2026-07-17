import { CalendarHeart, LayoutGrid, MessageCircle, Share } from "lucide-react";
import { useMomentActivityStore, useSelectedStore } from "@/stores";
import MomentInteraction from "./MomentInteraction";
import { useTranslation } from "react-i18next";

const BottomMenu = ({
  setIsBottomOpen,
  setOptionModalOpen,
  setIsProfileOpen,
  setIsHomeOpen,
}) => {
  const { t } = useTranslation("main");
  const selectedMoment = useSelectedStore((s) => s.selectedMoment);
  const selectedQueue = useSelectedStore((s) => s.selectedQueue);

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

  const handleReturnHome = () => {
    resetSelection();
    setIsBottomOpen(false);
  };

  const handleClose = () => {
    resetSelection();
  };

  const handleOpenCalendar = () => {
    resetSelection();
    setIsBottomOpen?.(false);
    setIsProfileOpen?.(true);
  };

  const handleOpenChat = () => {
    resetSelection();
    setIsBottomOpen?.(false);
    setIsHomeOpen?.(true);
  };

  const hasSelection =
    selectedMoment !== null || selectedQueue !== null;

  return (
    <div className="w-full px-2 pb-1 text-base-content space-y-2 shrink-0">
      {typeof selectedMoment === "number" && <MomentInteraction />}

      <nav className="cameraBottomNav" aria-label="Main">
        {hasSelection ? (
          <button
            type="button"
            className="cameraBottomNavBtn"
            onClick={handleClose}
            aria-label={t("bottom.grid", { defaultValue: "Lưới" })}
          >
            <LayoutGrid size={24} />
          </button>
        ) : (
          <button
            type="button"
            className="cameraBottomNavBtn"
            onClick={handleOpenCalendar}
            aria-label={t("bottom.open_calendar", { defaultValue: "Lịch" })}
          >
            <CalendarHeart size={24} />
          </button>
        )}

        <button
          type="button"
          className="cameraBottomNavBtn is-active"
          onClick={handleReturnHome}
          aria-label={t("bottom.home", { defaultValue: "Camera" })}
        >
          <span className="cameraBottomNavHomeDot" aria-hidden />
        </button>

        {hasSelection ? (
          <button
            type="button"
            className="cameraBottomNavBtn"
            onClick={() => setOptionModalOpen(true)}
            aria-label={t("bottom.share", { defaultValue: "Chia sẻ" })}
          >
            <Share size={24} />
          </button>
        ) : (
          <button
            type="button"
            className="cameraBottomNavBtn"
            onClick={handleOpenChat}
            aria-label={t("bottom.chat", { defaultValue: "Chat" })}
          >
            <MessageCircle size={24} />
          </button>
        )}
      </nav>
    </div>
  );
};

export default BottomMenu;
