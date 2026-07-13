import React, { useRef } from "react";
import { useApp } from "@/context/AppContext";
import { RefreshCcw } from "lucide-react";

const CameraToggleAndroid = () => {
  const { camera } = useApp();
  const {
    rotation,
    setRotation,
    cameraMode,
    setCameraMode,
    setDeviceId,
    setZoomLevel,
    setCurrentLensType,
    setCurrentZoom,
    setActiveZoomMode,
  } = camera;

  /**
   * Flip front/back.
   * Front (user): reset to 1x, no 0.5x, lens=front — MediaPreview uses startFrontCamera.
   * Rear (environment): land on main @ 1x (never tele).
   */
  const flippingRef = useRef(false);

  const handleRotateCamera = () => {
    // Debounce flip — tránh double-tap (giữ ngắn để lật lại nhanh)
    if (flippingRef.current) return;
    flippingRef.current = true;
    setTimeout(() => {
      flippingRef.current = false;
    }, 280);

    setRotation((prev) => prev - 180);
    const newMode = cameraMode === "user" ? "environment" : "user";
    // Không set spinner ngay — MediaPreview chỉ hiện nếu >180ms
    setCameraMode(newMode);
    setZoomLevel("1x");
    setActiveZoomMode?.("1x");
    setCurrentZoom?.(1);
    setDeviceId(null);
    setCurrentLensType?.(newMode === "environment" ? "main" : "front");
  };

  return (
    <button
      type="button"
      className="cursor-pointer touch-manipulation"
      onClick={handleRotateCamera}
      aria-label="Đổi camera"
    >
      <RefreshCcw
        size={35}
        className="transition-transform duration-300 active:scale-95"
        style={{ transform: `rotate(${rotation}deg)` }}
      />
    </button>
  );
};

export default CameraToggleAndroid;
