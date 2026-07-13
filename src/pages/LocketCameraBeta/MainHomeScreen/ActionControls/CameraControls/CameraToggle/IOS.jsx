import React, { useRef } from "react";
import { useApp } from "@/context/AppContext";
import { RefreshCcw } from "lucide-react";

const CameraToggleIOS = () => {
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

  const flippingRef = useRef(false);

  const handleRotateCamera = () => {
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

export default CameraToggleIOS;
