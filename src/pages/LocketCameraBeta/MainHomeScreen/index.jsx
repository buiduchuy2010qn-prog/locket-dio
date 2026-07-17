import React, { lazy, Suspense } from "react";
import { useApp } from "@/context/AppContext";

import HeaderHome from "./Layout/HeaderHome";
import HistoryArrow from "./Layout/HistoryButton";
import ActionControls from "./ActionControls";
import MediaPreview from "./Layout/MediaPreview";
import CameraBottomNav from "./Layout/CameraBottomNav";
import BottomMenu from "../BottomHomeScreen/Layout/BottomMenu";
import { usePostStore } from "@/stores";
import clsx from "clsx";
import "./cameraLayout.css";

const BottomHomeScreen = lazy(() => import("../BottomHomeScreen"));
const SelectFriendsList = lazy(() => import("./Layout/SelectFriends"));

export default function MainHomeScreen() {
  const { navigation } = useApp();

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
  const preview = usePostStore((s) => s.preview);
  const hasCaptured = !!(selectedFile || preview);

  return (
    <div
      className={clsx("cameraScreen text-base-content", {
        "cameraScreen--history": isBottomOpen,
        "translate-x-full": isProfileOpen,
        "-translate-x-full": !isProfileOpen && isHomeOpen,
        "translate-x-0": !isProfileOpen && !isHomeOpen,
      })}
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

      {/* History / moments panel */}
      <div className="historyColumn">
        <div className="historyColumnScroll">
          <Suspense fallback={null}>
            <BottomHomeScreen />
          </Suspense>
        </div>
        <BottomMenu
          setIsBottomOpen={setIsBottomOpen}
          setOptionModalOpen={setOptionModalOpen}
          setIsProfileOpen={setIsProfileOpen}
          setIsHomeOpen={setIsHomeOpen}
        />
      </div>

      {/* Camera column — document flow */}
      <div className="cameraColumn">
        <div className="cameraPreviewShell">
          <MediaPreview />
        </div>

        <ActionControls />

        <div className="w-full flex flex-col items-center">
          {hasCaptured ? (
            <div className="w-full max-w-md px-2 mt-2">
              <Suspense fallback={null}>
                <SelectFriendsList />
              </Suspense>
            </div>
          ) : (
            <HistoryArrow
              setIsBottomOpen={setIsBottomOpen}
              isOpen={isBottomOpen}
            />
          )}
        </div>

        {!hasCaptured && (
          <CameraBottomNav
            active="home"
            setIsBottomOpen={setIsBottomOpen}
            setIsProfileOpen={setIsProfileOpen}
            setIsHomeOpen={setIsHomeOpen}
          />
        )}
      </div>
    </div>
  );
}
