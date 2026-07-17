import React, { lazy, Suspense } from "react";
import { useAppNavigation } from "@/context/AppContext";

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
  } = useAppNavigation();
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);
  const hasCaptured = !!(selectedFile || preview);

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
          <div className="w-full max-w-md px-2">
            <MediaPreview />
          </div>
          <ActionControls />
          <div className="relative w-full">
            <div
              className={clsx("transition-all duration-300", {
                "opacity-0 invisible hidden": !hasCaptured,
                "opacity-100 visible": hasCaptured,
              })}
            >
              <Suspense fallback={null}>
                <SelectFriendsList />
              </Suspense>
            </div>

            {/* Chỉ Lịch sử — không nút calendar cạnh đó */}
            <div
              className={clsx("transition-all duration-300", {
                "opacity-0 invisible hidden": hasCaptured,
                "opacity-100 visible": !hasCaptured,
              })}
            >
              <HistoryArrow setIsBottomOpen={setIsBottomOpen} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
