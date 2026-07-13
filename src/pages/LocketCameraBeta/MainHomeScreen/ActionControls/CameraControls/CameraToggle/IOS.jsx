import React from "react";
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
    setIsSwitchingCamera,
  } = camera;

  /** Flip front/back — always land on main rear @ 1x (never tele). */
  const handleRotateCamera = async () => {
    setRotation((prev) => prev - 180);
    const newMode = cameraMode === "user" ? "environment" : "user";
    setIsSwitchingCamera?.(true);
    setCameraMode(newMode);
    setZoomLevel("1x");
    setDeviceId(null);
    setCurrentLensType?.(newMode === "environment" ? "main" : "unknown");
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
