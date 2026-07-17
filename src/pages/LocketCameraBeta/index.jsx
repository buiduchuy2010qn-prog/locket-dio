import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useAppNavigation } from "@/context/AppContext";
import MainHomeScreen from "./MainHomeScreen";
import { MusicPlayer } from "./Widgets/MusicPlayer";
import { useOverlayEditorStore, useUIStore } from "@/stores";
import GlobalReactionEffect from "./Widgets/GlobalReactionEffect";

const BgHuyLocket = lazy(() => import("@/components/Effects/BgLocketDio"));

const LeftHomeScreen = lazy(() => import("./LeftHomeScreen"));
const RightHomeScreen = lazy(() => import("./RightHomeScreen"));

const FriendsContainer = lazy(() => import("../../features/FriendsContainer"));
const EmojiPicker = lazy(() => import("@/features/EmojiStudio"));
const ScreenCustomeStudio = lazy(() => import("@/features/CustomeStudio"));
const CropImageStudio = lazy(() => import("@/features/EditorStudio/CropImageStudio"));
const CropVideoStudio = lazy(() => import("@/features/EditorStudio/CropVideoStudio"));
const OptionMoment = lazy(() => import("@/features/OptionMoment"));
const WelcomeModal = lazy(() => import("./Widgets/WelcomeModal"));

function idleSchedule(fn) {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(() => fn(), { timeout: 2500 });
    return () => cancelIdleCallback(id);
  }
  const t = setTimeout(fn, 400);
  return () => clearTimeout(t);
}

export default function LocketCameraBeta() {
  // Navigation only — do NOT subscribe to camera (zoom must not re-render this shell)
  const {
    isHomeOpen,
    isProfileOpen,
    setIsHomeOpen,
    setIsProfileOpen,
    isOptionModalOpen,
    setOptionModalOpen,
  } = useAppNavigation();

  // Local canvas for legacy capture helpers (CameraButton uses its own)
  const canvasRef = useRef(null);

  const overlayData = useOverlayEditorStore((s) => s.overlayData);
  const background = useUIStore((s) => s.background);

  // Mount side panels only after first open (keep mounted afterward for swipe state)
  const [leftReady, setLeftReady] = useState(false);
  const [rightReady, setRightReady] = useState(false);

  useEffect(() => {
    if (isProfileOpen) setLeftReady(true);
  }, [isProfileOpen]);

  useEffect(() => {
    if (isHomeOpen) setRightReady(true);
  }, [isHomeOpen]);

  // Preload heavy side chunks when browser is idle (not on first paint)
  useEffect(() => {
    return idleSchedule(() => {
      import("./LeftHomeScreen");
      import("./RightHomeScreen");
      import("../../features/FriendsContainer");
      import("@/features/CustomeStudio");
    });
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <BgHuyLocket bgSrc={background?.url} />
        <GlobalReactionEffect />
      </Suspense>

      <MainHomeScreen />

      {/* Page Views — mount once opened (or preloaded after idle) */}
      <Suspense fallback={null}>
        {leftReady ? (
          <LeftHomeScreen setIsProfileOpen={setIsProfileOpen} />
        ) : null}
        {rightReady ? <RightHomeScreen setIsHomeOpen={setIsHomeOpen} /> : null}
      </Suspense>

      {/* Modal Views — lazy chunks; preload on idle above */}
      <Suspense fallback={null}>
        <FriendsContainer />
        <CropImageStudio />
        <CropVideoStudio />
        <ScreenCustomeStudio />
        <EmojiPicker />
        <OptionMoment
          setOptionModalOpen={setOptionModalOpen}
          isOptionModalOpen={isOptionModalOpen}
        />
        <WelcomeModal />
      </Suspense>

      <canvas ref={canvasRef} className="hidden" />
      {overlayData.type === "music" && (
        <MusicPlayer music={overlayData.payload} />
      )}
      <span className="fixed pointer-events-none z-60 bottom-3 right-4 text-xs text-gray-400 select-none">
        © Huy Locket
      </span>
    </>
  );
}
