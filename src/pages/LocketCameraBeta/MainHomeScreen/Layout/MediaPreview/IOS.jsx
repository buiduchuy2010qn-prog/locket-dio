import React, { lazy, Suspense, useEffect, useRef, useState, useCallback } from "react";
import {
  getAvailableCameras,
  getMainBackCameraId,
  startCameraByDeviceId,
  stopCurrentCamera,
  getCurrentTrackCapabilities,
  getCurrentTrackSettings,
  getActiveVideoTrack,
  supportsHardwareZoom,
  setCameraZoom,
  readZoomRange,
  computeAvailableZoomModes,
  ensureMainCameraStream,
  resolveZoomModeTarget,
  classifyLensType,
  formatZoomModeLabel,
  ZOOM_MODES,
  isUltraLabel,
  isTeleLabel,
} from "@/utils";
const EditorCaption = lazy(() => import("@/features/EditorCaption"));
import { useApp } from "@/context/AppContext";
import BorderProgress from "../../Widgets/SquareProgress";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { usePostStore, useUIStore } from "@/stores";
import { useTranslation } from "react-i18next";

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
    setCurrentLensType,
    setCurrentZoom,
    setMinZoom,
    setMaxZoom,
    setZoomStep,
    availableZoomModes,
    setAvailableZoomModes,
    isSwitchingCamera,
    setIsSwitchingCamera,
    setDetectedCameras,
  } = camera;
  const { setSendLoading } = useloading;
  const { isBottomOpen, isHomeOpen, isProfileOpen } = navigation || {};

  const cameraInitialized = useRef(false);
  const lastCameraMode = useRef(cameraMode);
  const lastDeviceId = useRef(deviceId);
  const lastZoomLevel = useRef(zoomLevel);
  const startRequestId = useRef(0);
  const detectedRef = useRef(null);
  const currentZoomValue = useRef(1);

  const [previewMirror, setPreviewMirror] = useState(
    () => cameraMode === "user",
  );
  const [videoEpoch, setVideoEpoch] = useState(0);
  const [pageVisible, setPageVisible] = useState(
    () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );

  const onCapturePage =
    !isBottomOpen && !isHomeOpen && !isProfileOpen && pageVisible;

  const cameraFrame = useUIStore((s) => s.cameraFrame);

  const syncZoomStateFromStream = useCallback(
    (stream, cameras) => {
      const range = readZoomRange(stream);
      setMinZoom(range.minZoom);
      setMaxZoom(range.maxZoom);
      setZoomStep(range.zoomStep);

      const detectedShape = {
        main: cameras?.backNormalCamera,
        ultrawide: cameras?.backUltraWideCamera,
        telephoto: cameras?.backZoomCamera,
        rear: cameras?.backCameras || [],
        front: cameras?.frontCameras || [],
        all: cameras?.allCameras || [],
      };
      const modes = computeAvailableZoomModes(detectedShape, stream);
      modes["1x"] = true;
      setAvailableZoomModes(modes);

      const settings = getCurrentTrackSettings(stream);
      const actualId = settings.deviceId || null;
      const device =
        cameras?.allCameras?.find((d) => d.deviceId === actualId) || null;
      setCurrentLensType(
        classifyLensType(device, detectedShape),
      );
      const z = settings.zoom ?? currentZoomValue.current ?? 1;
      currentZoomValue.current = z;
      setCurrentZoom(z);
      if (actualId) lastDeviceId.current = actualId;
    },
    [
      setAvailableZoomModes,
      setCurrentLensType,
      setCurrentZoom,
      setMaxZoom,
      setMinZoom,
      setZoomStep,
    ],
  );

  const applyDigitalZoom = async (value, stream = streamRef.current) => {
    const applied = await setCameraZoom(stream, value);
    if (applied !== false) {
      currentZoomValue.current = applied;
      setCurrentZoom(applied);
      return true;
    }
    return false;
  };

  const handleSelectZoomMode = async (mode) => {
    if (isSwitchingCamera) return;
    if (mode === zoomLevel && mode !== "0.5x") return;

    const isBack = cameraMode === "environment";
    const cameras =
      detectedRef.current || (await getAvailableCameras({ force: false }));
    detectedRef.current = cameras;
    setDetectedCameras(cameras);

    const detectedShape = {
      main: cameras?.backNormalCamera,
      ultrawide: cameras?.backUltraWideCamera,
      telephoto: cameras?.backZoomCamera,
      rear: cameras?.backCameras || [],
      front: cameras?.frontCameras || [],
      all: cameras?.allCameras || [],
    };

    const modes =
      availableZoomModes ||
      computeAvailableZoomModes(detectedShape, streamRef.current);

    if (mode !== "1x" && modes[mode] === false) {
      SonnerInfo(
        t(
          mode === "0.5x"
            ? "home.zoom_05_unsupported"
            : mode === "2x"
              ? "home.zoom_2x_unsupported"
              : mode === "max"
                ? "home.zoom_max_unsupported"
                : "home.camera_no_zoom",
          { defaultValue: t("home.camera_no_zoom") },
        ),
      );
      return;
    }

    const target = resolveZoomModeTarget(mode, {
      detected: detectedShape,
      stream: streamRef.current,
      facingMode: isBack ? "environment" : "user",
    });

    if (target.unavailable) {
      SonnerInfo(
        t(
          mode === "0.5x"
            ? "home.zoom_05_unsupported"
            : mode === "max"
              ? "home.zoom_max_unsupported"
              : "home.camera_no_zoom",
          { defaultValue: t("home.camera_no_zoom") },
        ),
      );
      return;
    }

    const sameDevice =
      target.deviceId &&
      (target.deviceId === deviceId ||
        target.deviceId === lastDeviceId.current);

    if (sameDevice || (!target.deviceId && streamRef.current)) {
      setZoomLevel(target.mode);
      lastZoomLevel.current = target.mode;
      if (target.digitalZoom != null && supportsHardwareZoom(streamRef.current)) {
        try {
          await applyDigitalZoom(target.digitalZoom);
        } catch {
          /* ignore */
        }
      } else if (target.mode === "1x" && supportsHardwareZoom(streamRef.current)) {
        const range = readZoomRange(streamRef.current);
        const one = range.minZoom <= 1 && range.maxZoom >= 1 ? 1 : range.minZoom;
        await applyDigitalZoom(one);
      }
      return;
    }

    setIsSwitchingCamera(true);
    setZoomLevel(target.mode);
    setDeviceId(target.deviceId || null);
  };

  const stopCamera = () => {
    startRequestId.current += 1;
    stopCurrentCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    cameraInitialized.current = false;
  };

  const startCamera = async () => {
    const requestId = startRequestId.current + 1;
    startRequestId.current = requestId;
    setIsSwitchingCamera(true);

    try {
      const mode = cameraMode || "user";
      const facingChanged = lastCameraMode.current !== mode;
      const trackLive =
        streamRef.current?.getVideoTracks?.()?.[0]?.readyState === "live";

      if (
        !facingChanged &&
        cameraInitialized.current &&
        streamRef.current &&
        trackLive &&
        lastZoomLevel.current === zoomLevel &&
        lastDeviceId.current === deviceId
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
      detectedRef.current = cameras;
      setDetectedCameras(cameras);

      const mainId =
        cameras?.backNormalCamera?.deviceId ||
        (await getMainBackCameraId()) ||
        cameras?.backCameras?.find(
          (c) => !isUltraLabel(c.label) && !isTeleLabel(c.label),
        )?.deviceId ||
        cameras?.backCameras?.[0]?.deviceId ||
        null;
      const ultraId = cameras?.backUltraWideCamera?.deviceId || null;
      const teleId = cameras?.backZoomCamera?.deviceId || null;
      const frontId = cameras?.frontCameras?.[0]?.deviceId || null;

      const detectedShape = {
        main: cameras?.backNormalCamera,
        ultrawide: cameras?.backUltraWideCamera,
        telephoto: cameras?.backZoomCamera,
        rear: cameras?.backCameras || [],
        front: cameras?.frontCameras || [],
        all: cameras?.allCameras || [],
      };

      let resolvedDeviceId = null;
      let digitalZoomTarget = 1;

      if (!isBack) {
        resolvedDeviceId = frontId || deviceId;
      } else {
        const target = resolveZoomModeTarget(z, {
          detected: detectedShape,
          stream: streamRef.current,
          facingMode: "environment",
        });
        if (deviceId && z === "0.5x" && ultraId && deviceId === ultraId) {
          resolvedDeviceId = ultraId;
        } else if (deviceId && z === "2x" && teleId && deviceId === teleId) {
          resolvedDeviceId = teleId;
        } else if (target.unavailable && z !== "1x") {
          resolvedDeviceId = mainId;
          setZoomLevel("1x");
        } else {
          resolvedDeviceId = target.deviceId || mainId;
          digitalZoomTarget =
            target.digitalZoom != null ? target.digitalZoom : 1;
        }
        if (z === "1x" || !z) {
          resolvedDeviceId = mainId;
          digitalZoomTarget = 1;
        }
      }

      const oldStream = streamRef.current;
      if (oldStream) {
        try {
          oldStream.getTracks().forEach((t) => t.stop());
        } catch {
          /* ignore */
        }
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        cameraInitialized.current = false;
      }

      if (facingChanged) {
        setPreviewMirror(mode === "user");
        setVideoEpoch((n) => n + 1);
      }

      let stream = await startCameraByDeviceId(resolvedDeviceId, {
        facingMode: mode,
        highRes: true,
        preferDeviceId: Boolean(resolvedDeviceId),
      });

      if (requestId !== startRequestId.current) {
        stopCurrentCamera(stream);
        return;
      }

      if (isBack && (z === "1x" || !z) && mainId) {
        stream = await ensureMainCameraStream(stream, mainId, {
          ...detectedShape,
          all: cameras?.allCameras,
          rear: cameras?.backCameras,
        });
        if (!stream) {
          cameraInitialized.current = false;
          return;
        }
        resolvedDeviceId = mainId;
      }

      if (requestId !== startRequestId.current) {
        stopCurrentCamera(stream);
        return;
      }

      streamRef.current = stream;
      cameraInitialized.current = true;
      lastCameraMode.current = mode;
      lastZoomLevel.current = zoomLevel || "1x";

      const track = getActiveVideoTrack(stream);
      const settings = track?.getSettings?.() || {};
      const actualId = settings.deviceId;
      lastDeviceId.current = actualId || resolvedDeviceId || deviceId;

      const facing = String(settings.facingMode || "").toLowerCase();
      const isFrontStream =
        facing === "user" ||
        facing === "front" ||
        (!facing && mode === "user");
      setPreviewMirror(isFrontStream);

      if (facingChanged) {
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
      }

      if (videoRef.current) {
        const v = videoRef.current;
        v.srcObject = stream;
        v.muted = true;
        v.playsInline = true;
        v.setAttribute("playsinline", "true");
        v.setAttribute("webkit-playsinline", "true");
        v.style.transform = isFrontStream
          ? "translateZ(0) scaleX(-1)"
          : "translateZ(0)";
        try {
          await v.play();
        } catch {
          /* ignore */
        }
      }

      if (supportsHardwareZoom(stream)) {
        try {
          if (z === "1x" || !z) {
            const range = readZoomRange(stream);
            const one =
              range.minZoom <= 1 && range.maxZoom >= 1 ? 1 : range.minZoom;
            await applyDigitalZoom(one, stream);
          } else if (digitalZoomTarget != null && digitalZoomTarget !== 1) {
            await applyDigitalZoom(digitalZoomTarget, stream);
          }
        } catch {
          /* ignore */
        }
      }

      syncZoomStateFromStream(stream, cameras);
    } catch (err) {
      console.error("startCamera iOS:", err);
      cameraInitialized.current = false;
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

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
    zoomLevel,
    preview,
    selectedFile,
    onCapturePage,
  ]);

  useEffect(() => {
    return () => {
      startRequestId.current += 1;
      stopCurrentCamera(streamRef.current, videoRef.current);
      streamRef.current = null;
      cameraInitialized.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!preview && !selectedFile && !cameraActive && onCapturePage) {
      setCameraActive(true);
    }
  }, [preview, selectedFile, cameraActive, onCapturePage, setCameraActive]);

  const showZoomUi =
    cameraMode === "environment" && !preview && !selectedFile && cameraActive;

  const modeEnabled = (mode) => {
    if (mode === "1x") return true;
    if (!availableZoomModes) return false;
    return Boolean(availableZoomModes[mode]);
  };

  return (
    <>
      <div
        className={`relative w-full max-w-md aspect-square bg-gray-800 rounded-[65px] overflow-hidden transition-transform duration-500 `}
      >
        {!preview && !selectedFile && cameraActive && (
          <video
            key={`ios-cam-${cameraMode}-${videoEpoch}`}
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
              transform: previewMirror
                ? "translateZ(0) scaleX(-1)"
                : "translateZ(0)",
              backfaceVisibility: "hidden",
            }}
          />
        )}

        {isSwitchingCamera && !preview && !selectedFile && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 pointer-events-none">
            <div className="w-8 h-8 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
          </div>
        )}

        {!preview && !selectedFile && (
          <>
            <div className="absolute inset-0 top-7 px-7 z-30 pointer-events-none flex justify-start text-base-content text-xs font-semibold">
              <button
                onClick={() => SonnerInfo(t("home.feature_coming_soon"))}
                className="pointer-events-auto w-7 h-7 p-1.5 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center"
              >
                <img src="/icons/bolt.fill.png" alt="Icon sấm sét" />
              </button>
            </div>

            {showZoomUi && (
              <div className="absolute inset-x-0 bottom-5 z-30 pointer-events-none flex justify-center">
                <div className="pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md">
                  {ZOOM_MODES.map((mode) => {
                    const active = (zoomLevel || "1x") === mode;
                    const enabled = modeEnabled(mode);
                    return (
                      <button
                        key={mode}
                        type="button"
                        disabled={!enabled || isSwitchingCamera}
                        onClick={() => handleSelectZoomMode(mode)}
                        className={`min-w-[2.25rem] h-8 px-2 rounded-full text-xs font-semibold transition-all
                          ${
                            active
                              ? "bg-white text-black scale-105"
                              : enabled
                                ? "bg-white/15 text-white hover:bg-white/25"
                                : "bg-white/5 text-white/30 cursor-not-allowed"
                          }`}
                        aria-label={`Zoom ${formatZoomModeLabel(mode)}`}
                      >
                        {formatZoomModeLabel(mode)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
            className={
              videoCropData
                ? "absolute"
                : `w-full h-full object-cover ${preview ? "opacity-100" : "opacity-0"}`
            }
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
