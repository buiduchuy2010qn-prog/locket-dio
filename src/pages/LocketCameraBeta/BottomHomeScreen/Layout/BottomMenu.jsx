import { CalendarHeart, LayoutGrid, Share } from "lucide-react";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { useMomentActivityStore, useSelectedStore } from "@/stores";
import MomentInteraction from "./MomentInteraction";
import { useTranslation } from "react-i18next";

const BottomMenu = ({ setIsBottomOpen, setOptionModalOpen }) => {
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

  return (
    <>
      <div className="fixed z-70 w-full bottom-0 px-5 pb-10 md:pb-5 text-base-content space-y-3">
        {typeof selectedMoment === "number" && <MomentInteraction />}

        <div className="grid grid-cols-3 items-center">
          <div className="flex justify-start select-none">
            {(selectedMoment !== null || selectedQueue !== null) && (
              <button
                className="btn btn-circle btn-lg p-2 backdrop-blur-xs bg-base-100/30 text-base-content cursor-pointer hover:bg-base-200/50 rounded-full transition-colors"
                onClick={handleClose}
              >
                <LayoutGrid size={28} />
              </button>
            )}
          </div>

          <div className="flex justify-center select-none">
            <button
              onClick={handleReturnHome}
              className="relative flex items-center justify-center w-11 h-11 hover:scale-105 active:scale-105"
            >
              <div className="absolute w-11 h-11 ring-4 text-primary rounded-full z-5 backdrop-blur-xs bg-base-100/10"></div>
              <div className="absolute rounded-full w-10 h-10 bg-base-100 z-10 shadow-sm border border-base-300"></div>
            </button>
          </div>

          <div className="flex justify-end">
            {(selectedMoment !== null || selectedQueue !== null) && (
              <button
                onClick={() => setOptionModalOpen(true)}
                className="btn btn-circle btn-lg p-2 backdrop-blur-xs bg-base-100/30 text-base-content cursor-pointer hover:bg-base-200/50 rounded-full transition-colors"
              >
                <Share size={28} />
              </button>
            )}
            {/* CALENDAR – mặc định hiện, ẩn khi có selection */}
            {selectedMoment === null && selectedQueue === null && (
              <button
                onClick={() => SonnerInfo(t("bottom.feature_in_development"))}
                className="btn btn-circle btn-lg backdrop-blur-xs bg-base-100/30 text-base-content cursor-pointer hover:bg-base-200/50 transition-colors"
              >
                <CalendarHeart size={28} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default BottomMenu;
