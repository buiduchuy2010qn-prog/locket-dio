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
  warmCameraList,
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
  // Front camera only
  startFrontCamera,
  refreshFrontCameraZoomCapabilities,
  resetFrontCameraZoom,
  applyFrontCameraZoom,
  handleFrontCameraPinchStart,
  handleFrontCameraPinchMove,
  handleFrontCameraPinchEnd,
  clearTrackZoomCache,
  captureVideoFreezeFrame,
} from "@/utils";
const EditorCaption = lazy(() => import("@/features/EditorCaption"));
import { useApp } from "@/context/AppContext";
import BorderProgress from "../../Widgets/SquareProgress";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { usePostStore, useUIStore } from "@/stores";
import { useTranslation } from "react-i18next";

/** Pinch: ~30fps UI, zoom HW coalesce — mượt không await block */
const PINCH_THROTTLE_MS = 33;
const BADGE_THROTTLE_MS = 50;

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
  const lastBadgeUpdate = useRef(0);
  const pendingZoom = useRef(null);
  const applyInFlight = useRef(false);
  const detectedRef = useRef(null);
  const boundsRef = useRef({ minZoom: 1, maxZoom: 1 });
  const switchSpinnerTimer = useRef(null);
  /** Trong lúc pinch: không đổi lens (tránh khựng restart stream) */
  const pinchingRef = useRef(false);

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
  /** Freeze frame khi flip — tránh màn đen */
  const [freezeFrame, setFreezeFrame] = useState(null);
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
    (stream, cameras, facing = "environment") => {
      const isFront = facing === "user";
      const shape = toDetectedShape(cameras);

      // Front: use ONLY front track capabilities — never rear ultra 0.5
      if (isFront) {
        const caps = refreshFrontCameraZoomCapabilities(stream);
        boundsRef.current = {
          minZoom: caps.minZoom,
          maxZoom: caps.maxZoom,
        };
        setMinZoom(caps.minZoom);
        setMaxZoom(caps.maxZoom);
        setZoomStep(caps.zoomStep || 0.1);
        setAvailableZoomModes({
          "0.5x": false, // never on front
          "1x": true,
          "2x": caps.supported && caps.maxZoom >= 1.8,
        });
        setCurrentLensType("front");
        const z = Math.max(
          1,
          settingsZoomOr(stream, currentZoomValue.current),
        );
        currentZoomValue.current = z;
        setCurrentZoom(z);
        const actualId = getCurrentTrackSettings(stream).deviceId;
        if (actualId) lastDeviceId.current = actualId;
        setTorchSupported(
          Boolean(getCurrentTrackCapabilities(stream)?.torch),
        );
        return;
      }

      const bounds = getEffectiveZoomBounds(shape, stream);
      const minZ =
        shape.ultrawide?.deviceId || (cameras?.backCameras?.length || 0) >= 2
          ? Math.min(bounds.minZoom, 0.5)
          : bounds.minZoom;
      boundsRef.current = {
        minZoom: minZ,
        maxZoom: bounds.maxZoom,
      };
      setMinZoom(minZ);
      setMaxZoom(bounds.maxZoom);
      setZoomStep(bounds.step || 0.1);

      const modes = computeAvailableZoomModes(shape, stream);
      modes["1x"] = true;
      if (!modes["0.5x"] && minZ < 0.95) modes["0.5x"] = true;
      if (!modes["0.5x"] && shape.ultrawide) modes["0.5x"] = true;
      setAvailableZoomModes(modes);

      const settings = getCurrentTrackSettings(stream);
      const actualId = settings.deviceId || null;
      const device =
        cameras?.allCameras?.find((d) => d.deviceId === actualId) || null;
      setCurrentLensType(classifyLensType(device, shape));

      const z = settings.zoom ?? currentZoomValue.current ?? 1;
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

  function settingsZoomOr(stream, fallback = 1) {
    const z = getCurrentTrackSettings(stream)?.zoom;
    return typeof z === "number" && Number.isFinite(z) ? z : fallback;
  }

  const applyTorchState = async (enabled, stream = streamRef.current) => {
    const track = getActiveVideoTrack(stream);
    const capabilities = getCurrentTrackCapabilities(stream);
    if (!track || !capabilities.torch) return false;
    await track.applyConstraints({ advanced: [{ torch: enabled }] });
    return true;
  };

  const scheduleBadge = useCallback(
    (z, modeHint) => {
      const now = Date.now();
      if (now - lastBadgeUpdate.current < BADGE_THROTTLE_MS) return;
      lastBadgeUpdate.current = now;
      setCurrentZoom(z);
      if (modeHint) setActiveZoomMode(modeHint);
    },
    [setActiveZoomMode, setCurrentZoom],
  );

  /**
   * Apply zoom. allowLensSwitch=false khi đang pinch → không restart stream giữa chừng.
   */
  const applyDisplayZoom = useCallback(
    async (displayZoom, { force = false, allowLensSwitch = true } = {}) => {
      const stream = streamRef.current;
      if (!stream) return false;

      const isFront = (cameraMode || "user") === "user";
      const canSwitchLens =
        allowLensSwitch && !pinchingRef.current && !isSwitchingCamera;

      // ── FRONT: chỉ HW zoom ≥1x, không đổi lens ──
      if (isFront) {
        const caps = refreshFrontCameraZoomCapabilities(stream);
        boundsRef.current = {
          minZoom: caps.minZoom,
          maxZoom: caps.maxZoom,
        };
        const clamped = Math.max(
          caps.minZoom,
          Math.min(Number(displayZoom) || 1, caps.maxZoom),
        );
        currentZoomValue.current = clamped;
        const modeHint = Math.abs(clamped - 1) < 0.12 ? "1x" : "custom";
        if (Math.abs(clamped - 1) < 0.12) lastZoomLevel.current = "1x";
        scheduleBadge(clamped, modeHint);

        if (!supportsHardwareZoom(stream)) return false;
        if (applyInFlight.current && !force) {
          pendingZoom.current = clamped;
          return false;
        }
        applyInFlight.current = true;
        try {
          await applyFrontCameraZoom(stream, clamped);
          return true;
        } finally {
          applyInFlight.current = false;
          if (pendingZoom.current != null) {
            const p = pendingZoom.current;
            pendingZoom.current = null;
            applyFrontCameraZoom(stream, p).catch(() => {});
          }
        }
      }

      const cameras = detectedRef.current;
      const shape = toDetectedShape(cameras);
      const bounds = boundsRef.current;
      const minZ = bounds.minZoom ?? 1;
      const maxZ = bounds.maxZoom ?? 1;
      const clamped = Math.max(minZ, Math.min(displayZoom, maxZ));

      currentZoomValue.current = clamped;
      let mode = "custom";
      if (clamped < 0.75) mode = "0.5x";
      else if (Math.abs(clamped - 1) < 0.15) mode = "1x";
      else if (clamped >= 1.7) mode = "2x";
      scheduleBadge(clamped, mode);
      if (mode === "0.5x" || mode === "1x") lastZoomLevel.current = mode;

      const mapped = mapDisplayZoomToLens(clamped, shape, stream);
      const settings = getCurrentTrackSettings(stream);
      const actualId =
        settings.deviceId || lastDeviceId.current || deviceId || null;
      const ultraId = shape.ultrawide?.deviceId || null;
      const mainId = shape.main?.deviceId || null;

      // Lens switch — CHỈ khi không pinch (tránh lag restart)
      if (canSwitchLens || force) {
        if (
          clamped < 0.92 &&
          ultraId &&
          actualId !== ultraId &&
          mapped.lensType === "ultrawide"
        ) {
          setZoomLevel("0.5x");
          lastZoomLevel.current = "0.5x";
          setActiveZoomMode("0.5x");
          currentZoomValue.current = 0.5;
          setCurrentZoom(0.5);
          setIsSwitchingCamera(true);
          setDeviceId(ultraId);
          return true;
        }

        if (
          clamped >= 0.92 &&
          ultraId &&
          actualId === ultraId &&
          mainId &&
          mainId !== ultraId
        ) {
          setZoomLevel("1x");
          lastZoomLevel.current = "1x";
          setActiveZoomMode("1x");
          currentZoomValue.current = Math.max(1, clamped);
          setCurrentZoom(Math.max(1, clamped));
          setIsSwitchingCamera(true);
          setDeviceId(mainId);
          return true;
        }

        if (
          mapped.lensType === "telephoto" &&
          mapped.deviceId &&
          actualId !== mapped.deviceId &&
          clamped >= 1.9
        ) {
          setZoomLevel("2x");
          setDeviceId(mapped.deviceId);
          return true;
        }
      }

      // HW zoom trên lens hiện tại — coalesce, không block
      const digi =
        mapped.digitalZoom != null
          ? mapped.digitalZoom
          : Math.max(1, clamped);
      if (supportsHardwareZoom(stream)) {
        if (applyInFlight.current && !force) {
          pendingZoom.current = digi;
          return false;
        }
        applyInFlight.current = true;
        try {
          const applied = await applyCameraZoom(stream, digi);
          if (applied !== false) return true;
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
      cameraMode,
      deviceId,
      isSwitchingCamera,
      scheduleBadge,
      setActiveZoomMode,
      setCurrentZoom,
      setDeviceId,
      setIsSwitchingCamera,
      setZoomLevel,
    ],
  );

  const handleSelectZoomMode = async (mode) => {
    if (isSwitchingCamera || isPinching) return;

    // Front camera: no 0.5x / lens presets — only 1x + optional digital zoom
    if ((cameraMode || "user") === "user") {
      if (mode === "0.5x") return;
      if (mode === "1x") {
        setActiveZoomMode("1x");
        setZoomLevel("1x");
        lastZoomLevel.current = "1x";
        currentZoomValue.current = 1;
        setCurrentZoom(1);
        try {
          await resetFrontCameraZoom(streamRef.current);
        } catch {
          /* ignore */
        }
      }
      return;
    }

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
    if (event.touches.length !== 2) return;

    event.preventDefault();
    pinchingRef.current = true;
    const isFront = (cameraMode || "user") === "user";
    const state = isFront
      ? handleFrontCameraPinchStart(event.touches, currentZoomValue.current)
      : handlePinchZoomStart(event.touches, currentZoomValue.current);
    pinchState.current = state;
    setIsPinching(true);
  };

  const onTouchMove = (event) => {
    if (!pinchState.current.active || event.touches.length !== 2) return;
    if (isSwitchingCamera) return;

    event.preventDefault();
    const now = Date.now();
    if (now - lastPinchApply.current < PINCH_THROTTLE_MS) return;
    lastPinchApply.current = now;

    const isFront = (cameraMode || "user") === "user";
    let { minZoom: mn, maxZoom: mx } = boundsRef.current;

    if (isFront) {
      mn = Math.max(1, mn ?? 1);
      mx = Math.max(mn, mx ?? 1);
    }

    const moved = isFront
      ? handleFrontCameraPinchMove(
          event.touches,
          pinchState.current,
          mn,
          mx,
        )
      : handlePinchZoomMove(
          event.touches,
          pinchState.current,
          mn,
          mx,
        );

    const startZoom = pinchState.current.zoom || 1;
    const startDist = pinchState.current.distance || moved.distance;
    if (!startDist || !moved.distance) return;

    let totalScale = moved.distance / startDist;
    if (totalScale < 1) {
      totalScale = Math.pow(totalScale, isFront ? 1.15 : 1.25);
    } else if (totalScale > 1) {
      totalScale = Math.pow(totalScale, 1.12);
    }

    let nextZoom = startZoom * totalScale;
    nextZoom = Math.max(mn, Math.min(nextZoom, mx));
    if (!isFront && nextZoom < 0.7 && mn <= 0.5) nextZoom = 0.5;
    if (isFront && nextZoom < 1) nextZoom = 1;

    currentZoomValue.current = nextZoom;
    // Badge throttle — không setState mỗi frame
    scheduleBadge(
      nextZoom,
      isFront
        ? Math.abs(nextZoom - 1) < 0.12
          ? "1x"
          : "custom"
        : nextZoom < 0.75
          ? "0.5x"
          : "custom",
    );

    // KHÔNG await — zoom HW chạy nền, UI không khựng
    applyDisplayZoom(nextZoom, { allowLensSwitch: false }).catch(() => {});
  };

  const onTouchEnd = () => {
    if (!pinchState.current.active && !isPinching) return;
    const isFront = (cameraMode || "user") === "user";
    pinchingRef.current = false;
    pinchState.current = {
      ...(isFront ? handleFrontCameraPinchEnd() : handlePinchZoomEnd()),
      zoom: currentZoomValue.current,
    };
    setIsPinching(false);

    const z = currentZoomValue.current;
    // Sau pinch: mới cho phép đổi lens (0.5 ultra) nếu cần
    applyDisplayZoom(z, { force: true, allowLensSwitch: true }).catch(
      () => {},
    );

    if (isFront) {
      if (Math.abs(z - 1) < 0.15) {
        setActiveZoomMode("1x");
        setZoomLevel("1x");
      } else {
        setActiveZoomMode("custom");
      }
      return;
    }
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
    pinchingRef.current = false;
    if (switchSpinnerTimer.current) {
      clearTimeout(switchSpinnerTimer.current);
      switchSpinnerTimer.current = null;
    }
    pinchState.current = handlePinchZoomEnd();
    setIsPinching(false);
    if (streamRef.current) clearTrackZoomCache(streamRef.current);
    stopCurrentCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
    cameraInitialized.current = false;
    setTorchSupported(false);
    setTorchEnabled(false);
    currentZoomValue.current = 1;
    setCurrentZoom(1);
    setActiveZoomMode("1x");
  };

  const attachStreamToVideo = (stream, mirror) => {
    const v = videoRef.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    v.muted = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "true");
    v.setAttribute("webkit-playsinline", "true");
    v.style.transform = mirror
      ? "translate3d(0,0,0) scaleX(-1)"
      : "translate3d(0,0,0)";
    try {
      v.disablePictureInPicture = true;
    } catch {
      /* ignore */
    }
    const clearFreeze = () => setFreezeFrame(null);
    v.addEventListener("playing", clearFreeze, { once: true });
    v.addEventListener("loadeddata", clearFreeze, { once: true });
    setTimeout(clearFreeze, 600);
    v.play().catch(() => {});
  };

  const startCamera = async () => {
    const requestId = startRequestId.current + 1;
    startRequestId.current = requestId;
    startingRef.current = true;
    // Không spinner đen — dùng freeze frame khi flip
    if (switchSpinnerTimer.current) {
      clearTimeout(switchSpinnerTimer.current);
      switchSpinnerTimer.current = null;
    }

    try {
      // Mặc định cam sau
      const mode = cameraMode || "environment";
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
          videoRef.current.play().catch(() => {});
        }
        return;
      }

      const isBack = mode === "environment";
      const z = zoomLevel || "1x";

      let cameras = detectedRef.current;
      if (!cameras) {
        cameras = await getAvailableCameras({ force: false });
        detectedRef.current = cameras;
        setDetectedCameras(cameras);
      }

      const mainId =
        cameras?.backNormalCamera?.deviceId ||
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

      // Flip: freeze frame ngay → stop cam cũ → mở cam mới (không màn đen)
      if (facingChanged && videoRef.current) {
        const freeze = captureVideoFreezeFrame(videoRef.current);
        if (freeze) setFreezeFrame(freeze);
      }

      // ── FRONT CAMERA PATH ──
      if (!isBack) {
        pinchState.current = handleFrontCameraPinchEnd();
        setIsPinching(false);
        setZoomLevel("1x");
        setActiveZoomMode("1x");
        currentZoomValue.current = 1;
        setCurrentZoom(1);
        lastZoomLevel.current = "1x";

        const oldStream = streamRef.current;
        setPreviewMirror(true);

        let stream;
        try {
          const front = await startFrontCamera({
            oldStream,
            videoEl: videoRef.current,
            deviceId: frontId || null,
            fast: true,
            stopFirst: true, // hardware single cam — stop rồi mở ngay
          });
          stream = front.stream;
          resolvedDeviceId = front.deviceId;
          displayZoom = front.currentZoom ?? 1;
          boundsRef.current = {
            minZoom: front.minZoom ?? 1,
            maxZoom: front.maxZoom ?? 1,
          };
        } catch (e) {
          console.error("startFrontCamera:", e);
          cameraInitialized.current = false;
          setFreezeFrame(null);
          return;
        }

        if (requestId !== startRequestId.current) {
          stopCurrentCamera(stream);
          return;
        }

        streamRef.current = stream;
        cameraInitialized.current = true;
        lastCameraMode.current = "user";
        if (resolvedDeviceId) lastDeviceId.current = resolvedDeviceId;

        attachStreamToVideo(stream, true);

        resetFrontCameraZoom(stream).catch(() => {});
        const caps = refreshFrontCameraZoomCapabilities(stream);
        boundsRef.current = {
          minZoom: caps.minZoom,
          maxZoom: caps.maxZoom,
        };
        currentZoomValue.current = 1;
        setCurrentZoom(1);
        setActiveZoomMode("1x");
        syncZoomStateFromStream(stream, cameras, "user");
        return;
      }

      // ── REAR CAMERA PATH ──
      {
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

        if (z === "1x" || !z) {
          resolvedDeviceId = mainId;
          digitalZoomTarget = 1;
          displayZoom = 1;
        }
      }

      const oldStream = streamRef.current;
      setPreviewMirror(false);

      // Flip: stop trước để mở rear ngay (không chờ dual stream)
      if (facingChanged && oldStream) {
        clearTrackZoomCache(oldStream);
        stopCurrentCamera(oldStream, null);
        streamRef.current = null;
      }

      let stream = await startCameraByDeviceId(resolvedDeviceId, {
        facingMode: "environment",
        highRes: false,
        preferDeviceId: Boolean(resolvedDeviceId),
        fast: facingChanged || !cameraInitialized.current,
      });

      if (requestId !== startRequestId.current) {
        stopCurrentCamera(stream);
        return;
      }

      if (isBack && (z === "1x" || !z) && mainId && !resolvedDeviceId) {
        stream = await ensureMainCameraStream(stream, mainId, {
          ...shape,
          all: cameras?.allCameras,
          rear: cameras?.backCameras,
        });
        if (!stream) {
          cameraInitialized.current = false;
          setFreezeFrame(null);
          return;
        }
        resolvedDeviceId = mainId;
      }

      if (requestId !== startRequestId.current) {
        stopCurrentCamera(stream);
        return;
      }

      // Lens switch (0.5/1/2) không flip: stop old sau khi new ready
      if (!facingChanged && oldStream && oldStream !== stream) {
        clearTrackZoomCache(oldStream);
        stopCurrentCamera(oldStream, null);
      }

      streamRef.current = stream;
      cameraInitialized.current = true;
      lastCameraMode.current = "environment";
      lastZoomLevel.current = zoomLevel || "1x";

      const track = getActiveVideoTrack(stream);
      const settings = track?.getSettings?.() || {};
      const actualId = settings.deviceId;
      if (actualId) lastDeviceId.current = actualId;
      else if (resolvedDeviceId) lastDeviceId.current = resolvedDeviceId;

      attachStreamToVideo(stream, false);

      if (supportsHardwareZoom(stream)) {
        const zoomTarget =
          z === "1x" || !z
            ? (() => {
                const range = readZoomRange(stream);
                return range.minZoom <= 1 && range.maxZoom >= 1
                  ? 1
                  : range.minZoom;
              })()
            : digitalZoomTarget;
        if (zoomTarget != null) {
          applyCameraZoom(stream, zoomTarget).catch(() => {});
          if (z === "1x" || !z) displayZoom = 1;
        }
      }

      currentZoomValue.current = displayZoom;
      setCurrentZoom(displayZoom);
      setActiveZoomMode(z === "0.5x" || z === "2x" || z === "1x" ? z : "1x");
      syncZoomStateFromStream(stream, cameras, "environment");

      if (torchEnabled) {
        applyTorchState(true, stream).catch(() => setTorchEnabled(false));
      }
    } catch (err) {
      console.error("startCamera:", err);
      cameraInitialized.current = false;
      setFreezeFrame(null);
    } finally {
      startingRef.current = false;
      setIsSwitchingCamera(false);
    }
  };

  useEffect(() => {
    removeCaptionZoomControls();
    // Preload danh sách cam — flip/zoom sau này không enumerate lại
    warmCameraList().catch(() => {});
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
  // Zoom badge for both front & rear when camera active
  const showZoomUi = showCameraUi;

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
            // Key ổn định — KHÔNG remount khi flip (tránh màn đen)
            key={`android-cam-${videoEpoch}`}
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

        {/* Freeze frame khi flip — che khoảng stop→open, không đen */}
        {freezeFrame && showCameraUi && !preview && !selectedFile && (
          <img
            src={freezeFrame}
            alt=""
            className="absolute inset-0 z-30 w-full h-full object-cover pointer-events-none"
            style={{
              transform: previewMirror
                ? "translate3d(0,0,0) scaleX(-1)"
                : "translate3d(0,0,0)",
            }}
            draggable={false}
          />
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

            {/* ONLY zoom indicator: top-right of camera frame (never top-left / caption) */}
            {showZoomUi && (
              <div className="absolute top-7 right-7 z-30 pointer-events-none">
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
                    // Front never shows 0.5x
                    if (
                      (cameraMode || "environment") === "user" &&
                      n < 1
                    )
                      return "1x";
                    if (Math.abs(n - 0.5) < 0.05) return "0.5x";
                    if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.05)
                      return `${Math.round(n)}x`;
                    return `${Number(n.toFixed(1))}x`;
                  })()}
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
