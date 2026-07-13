// src/hooks/useCamera.js
import { useState, useRef } from "react";

export const useCamera = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const cameraRef = useRef(null);

  const [permissionChecked, setPermissionChecked] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [holdTime, setHoldTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(null);
  /** "user" | "environment" */
  const [cameraMode, setCameraMode] = useState("user");
  /** "0.5x" | "1x" | "2x" — default main x1 */
  const [zoomLevel, setZoomLevel] = useState("1x");
  const [deviceId, setDeviceId] = useState(null);

  // Lens / zoom system state
  const [currentLensType, setCurrentLensType] = useState("unknown");
  const [currentZoom, setCurrentZoom] = useState(1);
  const [minZoom, setMinZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(1);
  const [zoomStep, setZoomStep] = useState(0.1);
  const [availableZoomModes, setAvailableZoomModes] = useState({
    "0.5x": true,
    "1x": true,
    "2x": false,
  });
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  /** "0.5x" | "1x" | "2x" | "custom" */
  const [activeZoomMode, setActiveZoomMode] = useState("1x");
  const [detectedCameras, setDetectedCameras] = useState(null);

  return {
    videoRef,
    streamRef,
    cameraRef,
    canvasRef,
    permissionChecked,
    setPermissionChecked,
    holdTime,
    setHoldTime,
    rotation,
    setRotation,
    isHolding,
    setIsHolding,
    loading,
    setLoading,
    countdown,
    setCountdown,
    cameraActive,
    setCameraActive,
    cameraMode,
    setCameraMode,
    deviceId,
    setDeviceId,
    zoomLevel,
    setZoomLevel,
    // lens system
    currentLensType,
    setCurrentLensType,
    currentZoom,
    setCurrentZoom,
    minZoom,
    setMinZoom,
    maxZoom,
    setMaxZoom,
    zoomStep,
    setZoomStep,
    availableZoomModes,
    setAvailableZoomModes,
    isSwitchingCamera,
    setIsSwitchingCamera,
    isPinching,
    setIsPinching,
    activeZoomMode,
    setActiveZoomMode,
    detectedCameras,
    setDetectedCameras,
  };
};
