import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  getAvailableCameras,
  isIOS,
  pickCameraDeviceId,
  getMainBackCameraId,
  isDeviceUltraWide,
  isUltraLabel,
} from "@/utils";
const EditorCaption = lazy(() => import("@/features/EditorCaption"));
import { useApp } from "@/context/AppContext";
import { CONFIG } from "@/config";
import BorderProgress from "../../Widgets/SquareProgress";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { usePostStore, useUIStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { getCameraPreviewConstraints } from "@/utils/device/perfProfile";

const MediaPreviewIOS = () => {
  const { useloading, camera, navigation } = useApp();
  const { t } = useTranslation("main");
  
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);
  const videoCropData = usePostStore((s) => s.videoCropData);
  
  const {
    streamRef,
    videoRef,
    cameraActive,
    setCameraActive,
    cameraMode,
    zoomLevel,
    setZoomLevel,
    deviceId,
    setDeviceId,
  } = camera;
  const { setSendLoading } = useloading;
  const { isBottomOpen, isHomeOpen, isProfileOpen } = navigation || {};

  const cameraInitialized = useRef(false);
  const lastCameraMode = useRef(cameraMode);
  const lastDeviceId = useRef(deviceId);
  const lastZoomLevel = useRef(zoomLevel);
  const startRequestId = useRef(0);
  const pinchState = useRef({
    active: false,
    distance: 0,
    zoom: 1,
    ultraId: null,
    mainId: null,
    switchedLens: false,
  });
  const currentZoomValue = useRef(1);
  const lastPinchUpdate = useRef(0);
  const [lensPills, setLensPills] = useState(["1x"]);
  const [zoomDisplay, setZoomDisplay] = useState("1x");
  const [pageVisible, setPageVisible] = useState(
    () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );

  const onCapturePage =
    !isBottomOpen && !isHomeOpen && !isProfileOpen && pageVisible;

  const cameraFrame = useUIStore((s) => s.cameraFrame);

  const refreshLensPills = async () => {
    const pills = new Set(["1x"]);
    try {
      const cameras = await getAvailableCameras();
      // Full zoom theo lens máy
      if (cameras?.backUltraWideCamera) pills.add("0.5x");
      pills.add("1x");
      if (cameras?.backZoomCamera) {
        pills.add("2x");
        pills.add("3x");
      } else {
        // Không tele: vẫn cho 2x (main)
        pills.add("2x");
      }
    } catch {
      /* ignore */
    }
    const order = ["0.5x", "1x", "2x", "3x"];
    setLensPills(order.filter((z) => pills.has(z)));
  };

  const handleSelectLens = async (label) => {
    const cameras = await getAvailableCameras();
    let newDeviceId = null;
    if (cameraMode === "user") {
      newDeviceId = cameras?.frontCameras?.[0]?.deviceId;
      setZoomLevel(label === "0.5x" ? "0.5x" : "1x");
      if (newDeviceId) setDeviceId(newDeviceId);
      return;
    }
    if (label === "1x" || label === "2x") {
      newDeviceId =
        cameras?.backNormalCamera?.deviceId || (await getMainBackCameraId());
    } else if (label === "0.5x") {
      newDeviceId =
        cameras?.backUltraWideCamera?.deviceId ||
        cameras?.backNormalCamera?.deviceId;
    } else {
      // 3x / tele
      newDeviceId =
        cameras?.backZoomCamera?.deviceId ||
        cameras?.backNormalCamera?.deviceId ||
        (await getMainBackCameraId());
    }
    if (!newDeviceId) {
      SonnerInfo(t("home.camera_no_zoom"));
      return;
    }
    setZoomLevel(label);
    setDeviceId(newDeviceId);
  };

  const iosDevice = isIOS();
  const stopCamera = () => {
    startRequestId.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    cameraInitialized.current = false;
  };

  const startCamera = async () => {
    const requestId = startRequestId.current + 1;
    startRequestId.current = requestId;

    try {
      const mode = cameraMode || "user";
      const facingChanged = lastCameraMode.current !== mode;
      const trackLive =
        streamRef.current?.getVideoTracks?.()?.[0]?.readyState === "live";

      // Skip khi cùng facing + zoom + device + stream live (0.5 ultra đổi deviceId → restart)
      const deviceMatches = !deviceId || lastDeviceId.current === deviceId;

      if (
        !facingChanged &&
        cameraInitialized.current &&
        streamRef.current &&
        trackLive &&
        lastZoomLevel.current === zoomLevel &&
        deviceMatches
      ) {
        if (videoRef.current && !videoRef.current.srcObject) {
          videoRef.current.srcObject = streamRef.current;
          try {
            await videoRef.current.play();
          } catch {
            /* ignore */
          }
        }
        return;
      }

      const isBack = mode === "environment";
      const z = zoomLevel || "1x";
      const cameras = await getAvailableCameras();
      // 1x = cam chính — không lấy backCameras[0] (có thể ultra)
      const mainId =
        cameras?.backNormalCamera?.deviceId ||
        cameras?.backCameras?.find(
          (c) =>
            !isUltraLabel(c?.label) &&
            !/tele|chụp\s*xa|periscope/i.test(c?.label || ""),
        )?.deviceId ||
        cameras?.backCameras?.find((c) => !isUltraLabel(c?.label))?.deviceId ||
        null;
      const ultraId = cameras?.backUltraWideCamera?.deviceId || null;
      const teleId = cameras?.backZoomCamera?.deviceId || null;
      const frontId = cameras?.frontCameras?.[0]?.deviceId || null;

      let resolvedDeviceId = null;
      if (isBack && (z === "1x" || !z)) {
        resolvedDeviceId = mainId;
      } else if (isBack && z === "0.5x") {
        resolvedDeviceId = ultraId || mainId;
      } else if (isBack && (z === "2x" || z === "3x" || z === "5x")) {
        resolvedDeviceId = teleId || mainId;
      } else if (!isBack) {
        resolvedDeviceId = frontId || deviceId;
      } else {
        resolvedDeviceId = mainId || (await pickCameraDeviceId(mode, z));
      }

      const quality = getCameraPreviewConstraints(
        CONFIG.app.camera.constraints.default,
      );
      const oldStream = streamRef.current;
      const switchingLens =
        Boolean(resolvedDeviceId) &&
        Boolean(lastDeviceId.current) &&
        lastDeviceId.current !== resolvedDeviceId;

      // iOS: nhả cam cũ khi lật facing hoặc đổi lens
      if ((facingChanged || switchingLens) && oldStream) {
        try {
          oldStream.getTracks().forEach((t) => t.stop());
        } catch {
          /* ignore */
        }
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        cameraInitialized.current = false;
      }

      let stream = null;

      const tryGum = async (video) =>
        navigator.mediaDevices.getUserMedia({ video, audio: false });

      // Ưu tiên exact deviceId (main/ultra/tele) — facingMode hay ra cam phụ
      if (resolvedDeviceId) {
        try {
          stream = await tryGum({
            deviceId: { exact: resolvedDeviceId },
            ...quality,
          });
        } catch {
          try {
            stream = await tryGum({
              deviceId: { ideal: resolvedDeviceId },
              ...quality,
            });
          } catch {
            stream = null;
          }
        }
      }

      if (!stream) {
        stream = await tryGum({
          facingMode: { ideal: mode },
          ...quality,
        });
      }

      if (requestId !== startRequestId.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      // 1x: nếu không đúng main → ép main
      if (isBack && (z === "1x" || !z) && mainId) {
        const actualId =
          stream.getVideoTracks?.()?.[0]?.getSettings?.()?.deviceId;
        if (actualId && actualId !== mainId) {
          stream.getTracks().forEach((t) => t.stop());
          try {
            stream = await tryGum({
              deviceId: { exact: mainId },
              ...quality,
            });
            resolvedDeviceId = mainId;
          } catch {
            try {
              stream = await tryGum({
                deviceId: { ideal: mainId },
                ...quality,
              });
              resolvedDeviceId = mainId;
            } catch {
              /* keep */
            }
          }
        }
      }

      if (requestId !== startRequestId.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      cameraInitialized.current = true;
      lastCameraMode.current = mode;
      lastZoomLevel.current = zoomLevel || "1x";
      const actualId = stream.getVideoTracks?.()?.[0]?.getSettings?.()?.deviceId;
      lastDeviceId.current = actualId || resolvedDeviceId || deviceId;
      if (isBack && (z === "1x" || !z)) {
        currentZoomValue.current = 1;
        setZoomDisplay("1x");
      }
      setTimeout(() => {
        refreshLensPills().catch(() => {});
      }, 0);

      if (videoRef.current) {
        const v = videoRef.current;
        v.srcObject = stream;
        v.muted = true;
        v.playsInline = true;
        v.setAttribute("playsinline", "true");
        v.setAttribute("webkit-playsinline", "true");
        try {
          await v.play();
        } catch {
          /* ignore */
        }
      }

      if (!facingChanged && !switchingLens && oldStream && oldStream !== stream) {
        try {
          oldStream.getTracks().forEach((t) => t.stop());
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      cameraInitialized.current = false;
    }
  };

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Preload zoom pills (0.5 / 1 / 2 / 3)
  useEffect(() => {
    if (!cameraActive || preview || selectedFile) return;
    refreshLensPills().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive, cameraMode]);

  useEffect(() => {
    const shouldRun =
      cameraActive && onCapturePage && !preview && !selectedFile;
    if (shouldRun) {
      startCamera();
    } else if (streamRef.current) {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cameraActive,
    cameraMode,
    deviceId,
    // zoomLevel: digital/nhãn — restart qua deviceId (0.5 ultra)
    preview,
    selectedFile,
    onCapturePage,
  ]);

  useEffect(() => {
    return () => {
      startRequestId.current += 1;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      cameraInitialized.current = false;
    };
  }, []);

  // Sau chụp xong (xóa preview) → bật lại cam nếu đang ở trang chụp
  useEffect(() => {
    if (
      !preview &&
      !selectedFile &&
      !cameraActive &&
      onCapturePage
    ) {
      setCameraActive(true);
    }
  }, [preview, selectedFile, cameraActive, onCapturePage, setCameraActive]);

  useEffect(() => {
    setZoomDisplay(zoomLevel || "1x");
    if (zoomLevel === "0.5x") currentZoomValue.current = 0.5;
    else if (zoomLevel === "1x" || !zoomLevel) currentZoomValue.current = 1;
  }, [zoomLevel]);

  const getTouchDistance = (touches) => {
    if (touches.length < 2) return 0;
    const [a, b] = touches;
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  };

  /** Pinch: 0.5 ultra ↔ main 1x ↔ tele; mặc định luôn main */
  const handlePreviewTouchStart = (event) => {
    if (preview || selectedFile) return;
    if (event.touches.length !== 2) return;
    event.preventDefault();

    getAvailableCameras()
      .then((cameras) => {
        if (!pinchState.current.active) return;
        pinchState.current.ultraId =
          cameras?.backUltraWideCamera?.deviceId || null;
        pinchState.current.mainId =
          cameras?.backNormalCamera?.deviceId ||
          cameras?.backCameras?.find((c) => !isUltraLabel(c?.label))
            ?.deviceId ||
          null;
        pinchState.current.teleId =
          cameras?.backZoomCamera?.deviceId || null;
      })
      .catch(() => {});

    const base =
      zoomLevel === "0.5x"
        ? 0.5
        : zoomLevel === "2x" || zoomLevel === "3x" || zoomLevel === "5x"
          ? Math.max(currentZoomValue.current, 2)
          : currentZoomValue.current || 1;

    pinchState.current = {
      active: true,
      distance: getTouchDistance(event.touches),
      zoom: base,
      ultraId: null,
      mainId: null,
      teleId: null,
      lastSwitchAt: 0,
    };
  };

  const handlePreviewTouchMove = (event) => {
    if (!pinchState.current.active || event.touches.length !== 2) return;
    const now = Date.now();
    if (now - lastPinchUpdate.current < 50) return;

    const nextDistance = getTouchDistance(event.touches);
    if (!nextDistance || !pinchState.current.distance) return;
    event.preventDefault();
    lastPinchUpdate.current = now;

    const scale = nextDistance / pinchState.current.distance;
    const targetZoom = pinchState.current.zoom * scale;
    const isBack = cameraMode === "environment";
    const ultraId = pinchState.current.ultraId;
    const mainId = pinchState.current.mainId;
    const teleId = pinchState.current.teleId;
    const canSwitch = now - (pinchState.current.lastSwitchAt || 0) > 450;
    const onUltra =
      zoomLevel === "0.5x" ||
      (ultraId && lastDeviceId.current === ultraId);
    const onTele =
      zoomLevel === "2x" ||
      zoomLevel === "3x" ||
      zoomLevel === "5x" ||
      (teleId && lastDeviceId.current === teleId);

    if (isBack && canSwitch) {
      if (targetZoom < 0.7 && ultraId && !onUltra) {
        pinchState.current.lastSwitchAt = now;
        pinchState.current.zoom = 0.5;
        currentZoomValue.current = 0.5;
        setZoomDisplay("0.5x");
        setZoomLevel("0.5x");
        setDeviceId(ultraId);
        return;
      }
      if (targetZoom >= 0.85 && onUltra && mainId) {
        pinchState.current.lastSwitchAt = now;
        pinchState.current.zoom = 1;
        currentZoomValue.current = 1;
        setZoomDisplay("1x");
        setZoomLevel("1x");
        setDeviceId(mainId);
        return;
      }
      if (targetZoom >= 1.9 && teleId && !onTele && !onUltra) {
        pinchState.current.lastSwitchAt = now;
        pinchState.current.zoom = 2;
        currentZoomValue.current = 2;
        setZoomDisplay("2x");
        setZoomLevel("2x");
        setDeviceId(teleId);
        return;
      }
      if (targetZoom < 1.65 && onTele && mainId) {
        pinchState.current.lastSwitchAt = now;
        pinchState.current.zoom = 1.5;
        currentZoomValue.current = 1.5;
        setZoomDisplay("1.5x");
        setZoomLevel("1x");
        setDeviceId(mainId);
        return;
      }
    }

    const shown = Math.max(0.5, Math.min(targetZoom, 5));
    currentZoomValue.current = shown;
    setZoomDisplay(`${Number(shown.toFixed(1))}x`);

    try {
      const track = streamRef.current?.getVideoTracks?.()?.[0];
      const caps = track?.getCapabilities?.() || {};
      if (caps.zoom && track && !onUltra) {
        const z = Math.max(
          caps.zoom.min,
          Math.min(Math.max(shown, 1), caps.zoom.max),
        );
        track.applyConstraints({ advanced: [{ zoom: z }] }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  };

  const handlePreviewTouchEnd = () => {
    pinchState.current = {
      active: false,
      distance: 0,
      zoom: currentZoomValue.current,
      ultraId: null,
      mainId: null,
      teleId: null,
      lastSwitchAt: 0,
    };
  };

  return (
    <>
      <div
        onTouchStart={handlePreviewTouchStart}
        onTouchMove={handlePreviewTouchMove}
        onTouchEnd={handlePreviewTouchEnd}
        onTouchCancel={handlePreviewTouchEnd}
        className={`relative w-full max-w-md aspect-square bg-gray-800 rounded-[65px] overflow-hidden transition-transform duration-500 `}
        style={{ touchAction: preview || selectedFile ? "auto" : "none" }}
      >
        {!preview && !selectedFile && cameraActive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            disablePictureInPicture
            disableRemotePlayback
            className={`w-full h-full object-cover object-center ${
              cameraActive ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{
              transform:
                cameraMode === "user"
                  ? "translateZ(0) scaleX(-1)"
                  : "translateZ(0)",
              willChange: "contents",
              backfaceVisibility: "hidden",
            }}
          />
        )}

        {!preview && !selectedFile && (
          <>
            {/* Flash + hiển thị zoom (read-only). Zoom = pinch 2 ngón. */}
            <div className="absolute inset-0 top-7 px-7 z-30 pointer-events-none flex justify-between text-base-content text-xs font-semibold">
              <button
                onClick={() => SonnerInfo(t("home.feature_coming_soon"))}
                className="pointer-events-auto w-7 h-7 p-1.5 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center"
              >
                <img src="/icons/bolt.fill.png" alt="Icon sấm sét" />
              </button>
              <span className="pointer-events-none min-w-8 h-8 px-2 rounded-full bg-black/25 backdrop-blur-md flex items-center justify-center text-xs text-white/90 font-semibold">
                {zoomDisplay}
              </span>
            </div>

            {cameraFrame?.imageSrc && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                <img
                  src={cameraFrame.imageSrc}
                  loading="lazy"
                  alt="Khung viền camera"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </>
        )}

        {preview?.type === "video" && (
          <video
            src={preview.data}
            autoPlay
            loop
            muted
            playsInline
            className={videoCropData ? "absolute" : `w-full h-full object-cover ${preview ? "opacity-100" : "opacity-0"}`}
            style={
              videoCropData
                ? {
                    width: `${10000 / videoCropData.width}%`,
                    height: `${10000 / videoCropData.height}%`,
                    left: `-${videoCropData.x * (100 / videoCropData.width)}%`,
                    top: `-${videoCropData.y * (100 / videoCropData.height)}%`,
                    maxWidth: "none",
                    maxHeight: "none",
                  }
                : {}
            }
          />
        )}

        {preview?.type === "image" && (
          <img
            src={preview.data}
            alt=""
            draggable={false}
            decoding="sync"
            fetchPriority="high"
            className="w-full h-full object-cover object-center select-none bg-black opacity-100"
            style={{ imageRendering: "auto", WebkitUserDrag: "none" }}
          />
        )}

        <div
          className={`absolute z-10 inset-x-0 bottom-0 px-4 pb-4 transform transition-all duration-300 
          ${
            preview
              ? "opacity-100"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
        >
          <Suspense fallback={null}>
            <EditorCaption />
          </Suspense>
        </div>

        <div className="absolute inset-0 z-50 pointer-events-none">
          <BorderProgress />
        </div>
      </div>
    </>
  );
};

export default MediaPreviewIOS;
