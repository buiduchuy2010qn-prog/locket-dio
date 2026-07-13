import React, {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  getAvailableCameras,
  getMainBackCameraId,
  startCameraByDeviceId,
  stopCurrentCamera,
  getCurrentTrackCapabilities,
  getCurrentTrackSettings,
  getActiveVideoTrack,
  supportsHardwareZoom,
  applyCameraZoom,
  readZoomRange,
  computeAvailableZoomModes,
  ensureMainCameraStream,
  resolveZoomModeTarget,
  classifyLensType,
  getEffectiveZoomBounds,
  mapDisplayZoomToLens,
  handlePinchZoomStart,
  handlePinchZoomMove,
  handlePinchZoomEnd,
  removeCaptionZoomControls,
  isUltraLabel,
  isTeleLabel,
} from "@/utils";
import ZoomPresets from "./ZoomPresets";
const EditorCaption = lazy(() => import("@/features/EditorCaption"));
import { useApp } from "@/context/AppContext";
import BorderProgress from "../../Widgets/SquareProgress";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { usePostStore, useUIStore } from "@/stores";
import { useTranslation } from "react-i18next";

const PINCH_THROTTLE_MS = 45;

const MediaPreviewAndroid = () => {
  const { camera, navigation } = useApp();
  const { t } = useTranslation("main");
  const {
    streamRef,
    videoRef,
    cameraActive,
    cameraMode,
    zoomLevel,
    setZoomLevel,
    deviceId,
    setDeviceId,
    currentZoom,
    setCurrentZoom,
    setCurrentLensType,
    setMinZoom,
    setMaxZoom,
    setZoomStep,
    availableZoomModes,
    setAvailableZoomModes,
    isSwitchingCamera,
    setIsSwitchingCamera,
    isPinching,
    setIsPinching,
    activeZoomMode,
    setActiveZoomMode,
    setDetectedCameras,
  } = camera;
  const { isBottomOpen, isHomeOpen, isProfileOpen } = navigation || {};

  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);
  const videoCropData = usePostStore((s) => s.videoCropData);

  const cameraInitialized = useRef(false);
  const lastCameraMode = useRef(cameraMode);
  const lastDeviceId = useRef(deviceId);
  const lastZoomLevel = useRef(zoomLevel);
  const startRequestId = useRef(0);
  const startingRef = useRef(false);
  const pinchState = useRef({
    active: false,
    distance: 0,
    zoom: 1,
    isPinching: false,
  });
  const currentZoomValue = useRef(1);
  const lastPinchApply = useRef(0);
  const pendingZoom = useRef(null);
  const applyInFlight = useRef(false);
  const detectedRef = useRef(null);
  const boundsRef = useRef({ minZoom: 1, maxZoom: 1 });

  const [pageVisible, setPageVisible] = useState(
    () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );

  const onCapturePage =
    !isBottomOpen && !isHomeOpen && !isProfileOpen && pageVisible;

  const cameraFrame = useUIStore((s) => s.cameraFrame);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [previewMirror, setPreviewMirror] = useState(
    () => cameraMode === "user",
  );
  const [videoEpoch, setVideoEpoch] = useState(0);

  const toDetectedShape = (cameras) => ({
    main: cameras?.backNormalCamera,
    ultrawide: cameras?.backUltraWideCamera,
    telephoto: cameras?.backZoomCamera,
    rear: cameras?.backCameras || [],
    front: cameras?.frontCameras || [],
    all: cameras?.allCameras || [],
  });

  const syncZoomStateFromStream = useCallback(
    (stream, cameras) => {
      const shape = toDetectedShape(cameras);
      const bounds = getEffectiveZoomBounds(shape, stream);
      boundsRef.current = {
        minZoom: bounds.minZoom,
        maxZoom: bounds.maxZoom,
      };
      setMinZoom(bounds.minZoom);
      setMaxZoom(bounds.maxZoom);
      setZoomStep(bounds.step || 0.1);

      const modes = computeAvailableZoomModes(shape, stream);
      modes["1x"] = true;
      // Always keep 0.5 in UI (disable only if truly impossible)
      if (!modes["0.5x"] && bounds.minZoom < 0.95) modes["0.5x"] = true;
      if (!modes["0.5x"] && shape.ultrawide) modes["0.5x"] = true;
      setAvailableZoomModes(modes);

      const settings = getCurrentTrackSettings(stream);
      const actualId = settings.deviceId || null;
      const device =
        cameras?.allCameras?.find((d) => d.deviceId === actualId) || null;
      setCurrentLensType(classifyLensType(device, shape));

      const z = settings.zoom ?? currentZoomValue.current ?? 1;
      // Display: if on ultra, show 0.5-ish unless track reports higher
      let display = z;
      if (
        shape.ultrawide?.deviceId &&
        actualId === shape.ultrawide.deviceId &&
        z <= 1.1
      ) {
        display = 0.5;
      }
      currentZoomValue.current = display;
      setCurrentZoom(display);
      if (actualId) lastDeviceId.current = actualId;

      setTorchSupported(Boolean(getCurrentTrackCapabilities(stream)?.torch));
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

  const applyTorchState = async (enabled, stream = streamRef.current) => {
    const track = getActiveVideoTrack(stream);
    const capabilities = getCurrentTrackCapabilities(stream);
    if (!track || !capabilities.torch) return false;
    await track.applyConstraints({ advanced: [{ torch: enabled }] });
    return true;
  };

  /** Throttled apply for pinch smoothness */
  const applyDisplayZoom = useCallback(
    async (displayZoom, { force = false } = {}) => {
      const stream = streamRef.current;
      if (!stream) return false;

      const cameras = detectedRef.current;
      const shape = toDetectedShape(cameras);
      const bounds = boundsRef.current;
      const clamped = Math.max(
        bounds.minZoom ?? 0.5,
        Math.min(displayZoom, bounds.maxZoom ?? 1),
      );

      currentZoomValue.current = clamped;
      setCurrentZoom(clamped);

      // Update active mode nearest preset
      let mode = "custom";
      if (Math.abs(clamped - 0.5) < 0.12) mode = "0.5x";
      else if (Math.abs(clamped - 1) < 0.15) mode = "1x";
      else if (Math.abs(clamped - 2) < 0.25) mode = "2x";
      setActiveZoomMode(mode);
      if (mode !== "custom") {
        setZoomLevel(mode);
        lastZoomLevel.current = mode;
      }

      const mapped = mapDisplayZoomToLens(clamped, shape, stream);
      const curId = lastDeviceId.current || deviceId;

      // Lens switch only when needed (not every pinch frame)
      if (
        mapped.deviceId &&
        curId &&
        mapped.deviceId !== curId &&
        (mapped.lensType === "ultrawide" ||
          mapped.lensType === "main" ||
          mapped.lensType === "telephoto")
      ) {
        // Only switch when crossing lens thresholds intentionally
        const crossingUltra =
          mapped.lensType === "ultrawide" && clamped < 0.85;
        const leavingUltra =
          mapped.lensType === "main" &&
          shape.ultrawide?.deviceId === curId &&
          clamped >= 0.85;
        const needTele =
          mapped.lensType === "telephoto" && clamped >= 1.9;

        if (crossingUltra || leavingUltra || needTele) {
          if (!force && isSwitchingCamera) return false;
          setDeviceId(mapped.deviceId);
          setZoomLevel(mapped.mode);
          return true;
        }
      }

      if (supportsHardwareZoom(stream) && mapped.digitalZoom != null) {
        if (applyInFlight.current && !force) {
          pendingZoom.current = mapped.digitalZoom;
          return false;
        }
        applyInFlight.current = true;
        try {
          const applied = await applyCameraZoom(stream, mapped.digitalZoom);
          if (applied !== false) {
            // Keep display as clamped continuous value
            return true;
          }
        } finally {
          applyInFlight.current = false;
          if (pendingZoom.current != null) {
            const p = pendingZoom.current;
            pendingZoom.current = null;
            applyCameraZoom(stream, p).catch(() => {});
          }
        }
      }
      return false;
    },
    [
      deviceId,
      isSwitchingCamera,
      setActiveZoomMode,
      setCurrentZoom,
      setDeviceId,
      setZoomLevel,
    ],
  );

  const handleSelectZoomMode = async (mode) => {
    if (isSwitchingCamera || isPinching) return;

    const cameras =
      detectedRef.current || (await getAvailableCameras({ force: false }));
    detectedRef.current = cameras;
    setDetectedCameras(cameras);
    const shape = toDetectedShape(cameras);

    const modes =
      availableZoomModes ||
      computeAvailableZoomModes(shape, streamRef.current);

    if (mode !== "1x" && modes[mode] === false) {
      // Try anyway for 0.5 via min zoom
      if (mode === "0.5x") {
        const range = readZoomRange(streamRef.current);
        if (!(range.supported && range.minZoom < 0.95) && !shape.ultrawide) {
          SonnerInfo(
            t("home.zoom_05_unsupported", {
              defaultValue: "0.5x is not supported on this device",
            }),
          );
          return;
        }
      } else {
        SonnerInfo(
          t("home.zoom_2x_unsupported", {
            defaultValue: t("home.camera_no_zoom"),
          }),
        );
        return;
      }
    }

    const target = resolveZoomModeTarget(mode, {
      detected: shape,
      stream: streamRef.current,
      facingMode:
        cameraMode === "environment" ? "environment" : "user",
    });

    if (target.unavailable) {
      SonnerInfo(
        t(
          mode === "0.5x"
            ? "home.zoom_05_unsupported"
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

    setActiveZoomMode(target.mode);
    setZoomLevel(target.mode);
    lastZoomLevel.current = target.mode;

    const display =
      target.displayZoom ??
      (mode === "0.5x" ? 0.5 : mode === "2x" ? 2 : 1);
    currentZoomValue.current = display;
    setCurrentZoom(display);

    if (sameDevice || (!target.deviceId && streamRef.current)) {
      if (
        target.digitalZoom != null &&
        supportsHardwareZoom(streamRef.current)
      ) {
        try {
          await applyCameraZoom(streamRef.current, target.digitalZoom);
        } catch {
          /* ignore */
        }
      }
      return;
    }

    setIsSwitchingCamera(true);
    setDeviceId(target.deviceId || null);
  };

  // ─── Pinch gestures ─────────────────────────────────────────────

  const onTouchStart = (event) => {
    if (preview || selectedFile) return;
    if (cameraMode !== "environment") return;
    if (event.touches.length !== 2) return;

    event.preventDefault();
    const state = handlePinchZoomStart(
      event.touches,
      currentZoomValue.current,
    );
    pinchState.current = state;
    setIsPinching(true);
  };

  const onTouchMove = async (event) => {
    if (!pinchState.current.active || event.touches.length !== 2) return;
    if (cameraMode !== "environment") return;

    event.preventDefault();
    const now = Date.now();
    if (now - lastPinchApply.current < PINCH_THROTTLE_MS) return;
    lastPinchApply.current = now;

    const { minZoom: mn, maxZoom: mx } = boundsRef.current;
    const moved = handlePinchZoomMove(
      event.touches,
      pinchState.current,
      mn,
      mx,
    );

    // Keep base distance for continuous scale from start
    // Re-anchor zoom for next frame relative to start distance
    const scale =
      moved.distance && pinchState.current.distance
        ? moved.distance / pinchState.current.distance
        : 1;
    // Use start zoom * total scale from original distance
    const startZoom = pinchState.current.zoom;
    const startDist = pinchState.current.distance || moved.distance;
    const totalScale = startDist ? moved.distance / startDist : 1;
    const nextZoom = Math.max(
      mn,
      Math.min(startZoom * totalScale, mx),
    );

    currentZoomValue.current = nextZoom;
    setCurrentZoom(nextZoom);
    setActiveZoomMode("custom");

    await applyDisplayZoom(nextZoom);
  };

  const onTouchEnd = () => {
    if (!pinchState.current.active && !isPinching) return;
    pinchState.current = {
      ...handlePinchZoomEnd(),
      zoom: currentZoomValue.current,
    };
    setIsPinching(false);

    // Snap active mode to nearest preset for highlight
    const z = currentZoomValue.current;
    if (Math.abs(z - 0.5) < 0.12) {
      setActiveZoomMode("0.5x");
      setZoomLevel("0.5x");
    } else if (Math.abs(z - 1) < 0.15) {
      setActiveZoomMode("1x");
      setZoomLevel("1x");
    } else if (Math.abs(z - 2) < 0.25) {
      setActiveZoomMode("2x");
      setZoomLevel("2x");
    } else {
      setActiveZoomMode("custom");
    }
  };

  const stopCamera = () => {
    startRequestId.current += 1;
    startingRef.current = false;
    pinchState.current = handlePinchZoomEnd();
    setIsPinching(false);
    stopCurrentCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    cameraInitialized.current = false;
    setTorchSupported(false);
    setTorchEnabled(false);
    currentZoomValue.current = 1;
    setCurrentZoom(1);
    setActiveZoomMode("1x");
  };

  const startCamera = async () => {
    const requestId = startRequestId.current + 1;
    startRequestId.current = requestId;
    startingRef.current = true;
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
      const shape = toDetectedShape(cameras);

      let resolvedDeviceId = null;
      let digitalZoomTarget = 1;
      let displayZoom = 1;

      if (!isBack) {
        resolvedDeviceId = frontId || deviceId;
      } else {
        const target = resolveZoomModeTarget(z, {
          detected: shape,
          stream: streamRef.current,
          facingMode: "environment",
        });

        if (deviceId && z === "0.5x" && ultraId && deviceId === ultraId) {
          resolvedDeviceId = ultraId;
          displayZoom = 0.5;
        } else if (deviceId && z === "2x" && teleId && deviceId === teleId) {
          resolvedDeviceId = teleId;
          displayZoom = 2;
        } else if (target.unavailable && z !== "1x") {
          resolvedDeviceId = mainId;
          setZoomLevel("1x");
          setActiveZoomMode("1x");
          displayZoom = 1;
        } else {
          resolvedDeviceId = target.deviceId || mainId;
          digitalZoomTarget =
            target.digitalZoom != null ? target.digitalZoom : 1;
          displayZoom = target.displayZoom ?? digitalZoomTarget;
        }

        // HARD RULE: 1x always main
        if (z === "1x" || !z) {
          resolvedDeviceId = mainId;
          digitalZoomTarget = 1;
          displayZoom = 1;
        }
      }

      const oldStream = streamRef.current;
      if (oldStream) {
        try {
          oldStream.getTracks().forEach((tr) => tr.stop());
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
          ...shape,
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
      if (actualId) lastDeviceId.current = actualId;
      else if (resolvedDeviceId) lastDeviceId.current = resolvedDeviceId;

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
          ? "translate3d(0,0,0) scaleX(-1)"
          : "translate3d(0,0,0)";
        try {
          v.disablePictureInPicture = true;
        } catch {
          /* ignore */
        }
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
            await applyCameraZoom(stream, one);
            displayZoom = 1;
          } else if (digitalZoomTarget != null) {
            await applyCameraZoom(stream, digitalZoomTarget);
          }
        } catch {
          /* ignore */
        }
      }

      currentZoomValue.current = displayZoom;
      setCurrentZoom(displayZoom);
      setActiveZoomMode(z === "0.5x" || z === "2x" || z === "1x" ? z : "1x");
      syncZoomStateFromStream(stream, cameras);

      if (torchEnabled) {
        try {
          await applyTorchState(true, stream);
        } catch {
          setTorchEnabled(false);
        }
      }
    } catch (err) {
      console.error("startCamera:", err);
      cameraInitialized.current = false;
    } finally {
      startingRef.current = false;
      setIsSwitchingCamera(false);
    }
  };

  useEffect(() => {
    removeCaptionZoomControls();
  }, []);

  useEffect(() => {
    const onVis = () => {
      setPageVisible(document.visibilityState === "visible");
    };
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

  const handleToggleTorch = async () => {
    if (!torchSupported) {
      SonnerInfo(t("home.flash_not_supported"));
      return;
    }
    const next = !torchEnabled;
    try {
      const applied = await applyTorchState(next);
      if (!applied) {
        SonnerInfo(t("home.flash_enable_failed"));
        return;
      }
      setTorchEnabled(next);
    } catch {
      SonnerInfo(t("home.flash_enable_failed"));
    }
  };

  const showCameraUi =
    !preview && !selectedFile && cameraActive;
  const showZoomUi = showCameraUi && cameraMode === "environment";

  return (
    <>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className="relative w-full max-w-md aspect-square bg-gray-800 rounded-[65px] overflow-hidden transition-transform duration-500"
        style={{
          // Prevent browser page-zoom while pinching camera
          touchAction: preview || selectedFile ? "auto" : "none",
        }}
      >
        {!preview && !selectedFile && cameraActive && (
          <video
            key={`android-cam-${cameraMode}-${videoEpoch}`}
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
                ? "translate3d(0,0,0) scaleX(-1)"
                : "translate3d(0,0,0)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          />
        )}

        {isSwitchingCamera && showCameraUi && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 pointer-events-none">
            <div className="w-8 h-8 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
          </div>
        )}

        {showCameraUi && (
          <>
            {/* Torch top-left area — zoom badge sits beside it */}
            <div className="absolute top-7 left-7 z-30 pointer-events-none flex items-center gap-2">
              <button
                onClick={handleToggleTorch}
                className="pointer-events-auto w-7 h-7 p-1.5 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center"
              >
                <img src="/icons/bolt.fill.png" alt="Flash" />
              </button>
            </div>

            {/* ONLY zoom indicator: top-left badge (offset right of flash) */}
            {showZoomUi && (
              <div className="absolute top-7 left-[3.75rem] z-30 pointer-events-none">
                <div
                  className="min-w-[2.5rem] h-7 px-2.5 rounded-full flex items-center justify-center
                    text-[11px] font-semibold tracking-wide text-white
                    bg-white/20 backdrop-blur-md border border-white/25 shadow-sm"
                  data-zoom-badge="true"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
                >
                  {(() => {
                    const n = Number(currentZoom);
                    if (!Number.isFinite(n)) return "1x";
                    if (Math.abs(n - 1) < 0.05) return "1x";
                    if (Math.abs(n - 0.5) < 0.05) return "0.5x";
                    if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.05)
                      return `${Math.round(n)}x`;
                    return `${Number(n.toFixed(1))}x`;
                  })()}
                </div>
              </div>
            )}

            {/* Presets 0.5 / 1x / 2x — bottom inside frame, NOT caption */}
            <ZoomPresets
              visible={showZoomUi}
              activeMode={activeZoomMode || zoomLevel || "1x"}
              currentZoom={currentZoom}
              available={availableZoomModes}
              disabled={isSwitchingCamera}
              onSelect={handleSelectZoomMode}
            />

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
            style={{
              imageRendering: "auto",
              WebkitUserDrag: "none",
            }}
          />
        )}

        {/* Caption ONLY — no zoom controls here */}
        <div
          className={`absolute z-10 inset-x-0 bottom-0 px-4 pb-4 transform transition-all duration-300 
          ${
            preview
              ? "opacity-100"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
          data-caption-area="true"
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

export default MediaPreviewAndroid;
