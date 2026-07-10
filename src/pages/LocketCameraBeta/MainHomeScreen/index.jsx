import React, { lazy, Suspense } from "react";
import { useApp } from "@/context/AppContext";
import { CalendarDays } from "lucide-react";

import HeaderHome from "./Layout/HeaderHome";
import BottomMenu from "../BottomHomeScreen/Layout/BottomMenu";
import HistoryArrow from "./Layout/HistoryButton";
import ActionControls from "./ActionControls";
import MediaPreview from "./Layout/MediaPreview";
import { usePostStore } from "@/stores";
import clsx from "clsx";

const BottomHomeScreen = lazy(() => import("../BottomHomeScreen"));
const SelectFriendsList = lazy(() => import("./Layout/SelectFriends"));

export default function MainHomeScreen() {
  const { navigation, camera, useloading, post } = useApp();

  const {
    isHomeOpen,
    isProfileOpen,
    isBottomOpen,
    setIsHomeOpen,
    setIsProfileOpen,
    setIsBottomOpen,
    setFriendsTabOpen,
    setIsSidebarOpen,
    setOptionModalOpen,
    isFriendHistoryOpen,
    setFriendHistoryOpen,
  } = navigation;
  const selectedFile = usePostStore((s) => s.selectedFile);

  const openStreakCalendar = () => {
    setIsBottomOpen(false);
    setIsProfileOpen(true);
  };

  return (
    <>
      <div
        className={clsx(
          "relative transition-all duration-500 flex flex-col justify-center items-center w-full h-[100vh] text-base-content",
          {
            "translate-x-full": isProfileOpen,
            "-translate-x-full": !isProfileOpen && isHomeOpen,
            "translate-x-0": !isProfileOpen && !isHomeOpen,
          },
        )}
      >
        <HeaderHome
          setIsHomeOpen={setIsHomeOpen}
          setIsProfileOpen={setIsProfileOpen}
          setFriendsTabOpen={setFriendsTabOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isBottomOpen={isBottomOpen}
          setFriendHistoryOpen={setFriendHistoryOpen}
          isFriendHistoryOpen={isFriendHistoryOpen}
          selectedFile={selectedFile}
        />
        <div
          className={clsx(
            "w-full h-full flex flex-1 flex-col transition-all duration-500 justify-center items-center",
            {
              "translate-x-0": isBottomOpen,
              "fixed translate-y-full": !isBottomOpen,
            },
          )}
        >
          <div className="w-full h-full overflow-y-auto">
            <div className="h-16" />
            <Suspense fallback={null}>
              <BottomHomeScreen />
            </Suspense>
          </div>
          <BottomMenu
            setIsBottomOpen={setIsBottomOpen}
            setOptionModalOpen={setOptionModalOpen}
            setIsProfileOpen={setIsProfileOpen}
          />
        </div>
        <div
          className={clsx(
            "w-full h-full flex flex-col transition-all duration-500 justify-evenly items-center",
            {
              "translate-x-0": !isBottomOpen,
              "fixed -translate-y-full": isBottomOpen,
            },
          )}
        >
          <div className="h-10" />
          {/* Camera full width — không nút đè lên ảnh */}
          <div className="w-full max-w-md px-2">
            <MediaPreview />
          </div>
          <ActionControls />
          <div className="relative w-full">
            <div
              className={clsx("transition-all duration-300", {
                "opacity-0 invisible hidden": !selectedFile,
                "opacity-100 visible": selectedFile,
              })}
            >
              <Suspense fallback={null}>
                <SelectFriendsList />
              </Suspense>
            </div>

            {/* Lịch sử + nút lịch chuỗi (dưới camera, không vướng hình) */}
            <div
              className={clsx(
                "transition-all duration-300 flex items-center justify-center gap-6",
                {
                  "opacity-0 invisible hidden": selectedFile,
                  "opacity-100 visible": !selectedFile,
                },
              )}
            >
              <button
                type="button"
                onClick={openStreakCalendar}
                aria-label="Mở lịch chuỗi"
                title="Lịch chuỗi Locket"
                className="flex items-center justify-center w-11 h-11 rounded-full bg-base-300/70 backdrop-blur-md border border-base-content/10 text-base-content active:scale-95 transition hover:bg-base-300"
              >
                <CalendarDays size={24} strokeWidth={1.75} />
              </button>
              <HistoryArrow setIsBottomOpen={setIsBottomOpen} />
              {/* Spacer cân đối 2 bên */}
              <div className="w-11 h-11" aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
