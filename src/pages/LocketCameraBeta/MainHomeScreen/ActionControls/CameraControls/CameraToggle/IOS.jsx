import React from "react";
import { useApp } from "@/context/AppContext";
import { RefreshCcw } from "lucide-react";

const CameraToggleIOS = () => {
  const { camera, useloading } = useApp();
  const {
    videoRef,
    streamRef,
    canvasRef,
    cameraRef,
    rotation,
    isHolding,
    setIsHolding,
    permissionChecked,
    setPermissionChecked,
    holdTime,
    setHoldTime,
    setRotation,
    cameraMode,
    setCameraMode,
    cameraActive,
    setCameraActive,
    setLoading,
    setDeviceId,
    setZoomLevel,
  } = camera;

  const handleRotateCamera = async () => {
    setRotation((prev) => prev - 180);
    const newMode = cameraMode === "user" ? "environment" : "user";
    // Chỉ đổi state — MediaPreview seamless switch (mở mới → gắn → tắt cũ)
    setCameraMode(newMode);
    setZoomLevel("1x");
    setDeviceId(null);
  };

  return (
    <>
      <button className="cursor-pointer" onClick={handleRotateCamera}>
        <RefreshCcw
          size={35}
          className="transition-transform duration-500 active:scale-95"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </button>
    </>
  );
};

export default CameraToggleIOS;
