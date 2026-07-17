import React, { useRef } from "react";
import { useAppCamera } from "@/context/AppContext";
import { RefreshCcw } from "lucide-react";

const CameraToggleIOS = () => {
  const camera = useAppCamera();
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
      className="pillSideBtn"
      onClick={handleRotateCamera}
      aria-label="Đổi camera"
      title="Đổi camera"
    >
      <RefreshCcw
        size={24}
        strokeWidth={2}
        className="transition-transform duration-300"
        style={{ transform: `rotate(${rotation}deg)` }}
      />
    </button>
  );
};

export default CameraToggleIOS;
