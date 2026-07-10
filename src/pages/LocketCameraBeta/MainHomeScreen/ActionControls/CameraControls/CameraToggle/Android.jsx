import React from "react";
import { useApp } from "@/context/AppContext";
import { pickCameraDeviceId } from "@/utils";
import { RefreshCcw } from "lucide-react";

const CameraToggleAndroid = () => {
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
    let nextDeviceId = null;

    try {
      // Luôn chọn lens chính 1x khi lật camera sau (không ultra 0.5x)
      nextDeviceId = await pickCameraDeviceId(newMode, "1x");
    } catch (error) {
      console.error("Lỗi khi lấy danh sách camera:", error);
    }

    setCameraMode(newMode);
    setZoomLevel("1x");
    setDeviceId(nextDeviceId);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
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

export default CameraToggleAndroid;
