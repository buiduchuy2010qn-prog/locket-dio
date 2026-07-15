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
  openCameraByFacing,
  switchToUltraWide05,
  switchToWidestLens,
  updateZoomBadge,
  getUltraWideFactor,
  resolveUltraWideFactor,
  readLiveZoomFromCamera,
  wideBandThreshold,
  applyLiveZoom,
  isWideZoomMode,
  WIDE_ZOOM_MODE,
  parkAtWidestTrackZoom,
  isUltraZoomValue,
} from "@/utils";
const EditorCaption = lazy(() => import("@/features/EditorCaption"));
import { useApp } from "@/context/AppContext";
import BorderProgress from "../../Widgets/SquareProgress";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import { usePostStore, useUIStore } from "@/stores";
import { useTranslation } from "react-i18next";
import ZoomPresets from "./ZoomPresets";
import RearLensPicker from "./RearLensPicker";

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
    detectedCameras,
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
    rear: cameras?.backCameras || cameras?.rearOptions || [],
    front: cameras?.frontCameras || [],
    all: cameras?.allCameras || [],
    rearOptions: cameras?.rearOptions || cameras?.backCameras || [],
    ultraConfidence: cameras?.ultraConfidence,
    needsManualLensPick: cameras?.needsManualLensPick,
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
      // min = factor thật (0.5/0.6/0.7) — không ép 0.5
      const minZ = bounds.minZoom;
      boundsRef.current = {
        minZoom: minZ,
        maxZoom: bounds.maxZoom,
      };
      setMinZoom(minZ);
      setMaxZoom(bounds.maxZoom);
      setZoomStep(bounds.step || 0.1);

      const modes = computeAvailableZoomModes(shape, stream);
      modes["1x"] = true;
      // Cam sau: luôn bật nút góc rộng — thử physical ultra + digital min
      modes["0.5x"] = true;
      modes.ultraFactor =
        modes.ultraFactor ||
        getUltraWideFactor(stream, shape) ||
        null;
      setAvailableZoomModes(modes);

      const settings = getCurrentTrackSettings(stream);
      const actualId = settings.deviceId || null;
      const device =
        cameras?.allCameras?.find((d) => d.deviceId === actualId) || null;
      setCurrentLensType(classifyLensType(device, shape));

      const z = settings.zoom ?? currentZoomValue.current ?? 1;
      let display = z;
      // Live factor only — never invent 0.5/0.6 when API omits zoom
      const uf = modes.ultraFactor || getUltraWideFactor(stream, shape);
      if (
        shape.ultrawide?.deviceId &&
        actualId === shape.ultrawide.deviceId &&
        z <= 1.1 &&
        uf != null
      ) {
        display = uf;
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
   * Apply zoom on the CURRENT track.
   * allowLensSwitch=false khi đang pinch / đã ở ultra → không restart stream.
   *
   * Sticky ultra-wide: once actualId === ultraId, NEVER setDeviceId(main)
   * just because zoom crossed 0.92. Leaving UW is only via preset 1x
   * (handleSelectZoomMode). Continuous zoom = applyCameraZoom only.
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
      // Prefer live track range (UW often has lower min than main)
      const liveRange = supportsHardwareZoom(stream)
        ? readZoomRange(stream)
        : null;
      const bounds = boundsRef.current;
      const minZ =
        liveRange?.supported && Number.isFinite(liveRange.minZoom)
          ? liveRange.minZoom
          : (bounds.minZoom ?? 1);
      const maxZ =
        liveRange?.supported && Number.isFinite(liveRange.maxZoom)
          ? liveRange.maxZoom
          : (bounds.maxZoom ?? 1);
      // Keep boundsRef in sync with active lens so pinch uses UW range
      boundsRef.current = { minZoom: minZ, maxZoom: maxZ };
      const clamped = Math.max(
        minZ,
        Math.min(Number(displayZoom) || minZ, maxZ),
      );

      const thr = wideBandThreshold(
        stream,
        availableZoomModes?.ultraFactor ??
          resolveUltraWideFactor(stream, shape, null),
      );
      currentZoomValue.current = clamped;
      let mode = "custom";
      if (clamped < thr) mode = WIDE_ZOOM_MODE;
      else if (Math.abs(clamped - 1) < 0.15) mode = "1x";
      else if (clamped >= 1.7) mode = "2x";
      scheduleBadge(clamped, mode);
      if (mode === WIDE_ZOOM_MODE || mode === "1x") lastZoomLevel.current = mode;

      const mapped = mapDisplayZoomToLens(clamped, shape, stream);
      const settings = getCurrentTrackSettings(stream);
      const actualId =
        settings.deviceId || lastDeviceId.current || deviceId || null;
      const ultraId = shape.ultrawide?.deviceId || null;
      const onPhysicalUltra = Boolean(
        ultraId && actualId && actualId === ultraId,
      );

      // Lens switch — only hop ONTO ultra/tele, never auto-leave ultra on zoom
      if (canSwitchLens && !onPhysicalUltra) {
        if (
          clamped < thr &&
          ultraId &&
          actualId !== ultraId &&
          mapped.lensType === "ultrawide"
        ) {
          const factor =
            mapped.displayZoom ??
            availableZoomModes?.ultraFactor ??
            getUltraWideFactor(stream, shape) ??
            null;
          setZoomLevel(WIDE_ZOOM_MODE);
          lastZoomLevel.current = WIDE_ZOOM_MODE;
          setActiveZoomMode(WIDE_ZOOM_MODE);
          currentZoomValue.current =
            factor != null ? factor : currentZoomValue.current || 1;
          setCurrentZoom(currentZoomValue.current);
          setIsSwitchingCamera(true);
          setDeviceId(ultraId);
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

      // HW zoom on CURRENT lens — clamp via live getCapabilities only
      const digi =
        mapped.digitalZoom != null
          ? mapped.digitalZoom
          : Math.max(minZ, Math.min(clamped, maxZ));
      if (supportsHardwareZoom(stream)) {
        if (applyInFlight.current && !force) {
          pendingZoom.current = digi;
          return false;
        }
        applyInFlight.current = true;
        try {
          const applied = await applyLiveZoom(stream, digi);
          if (applied !== false) {
            if (onPhysicalUltra || mapped.lensType === "ultrawide") {
              setCurrentLensType("ultrawide");
            }
            return true;
          }
        } finally {
          applyInFlight.current = false;
          if (pendingZoom.current != null) {
            const p = pendingZoom.current;
            pendingZoom.current = null;
            applyLiveZoom(stream, p).catch(() => {});
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
      setCurrentLensType,
      setCurrentZoom,
      setDeviceId,
      setIsSwitchingCamera,
      setZoomLevel,
      availableZoomModes?.ultraFactor,
    ],
  );

  const handleSelectZoomMode = async (mode) => {
    if (isSwitchingCamera || isPinching) return;

    // Cam trước: nút 1x / 2x (digital zoom) — không 0.5x
    if ((cameraMode || "environment") === "user") {
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
        return;
      }
      if (mode === "2x" || mode === "2") {
        const stream = streamRef.current;
        const caps = refreshFrontCameraZoomCapabilities(stream);
        const target = Math.min(2, caps.maxZoom || 2);
        if (!caps.supported || target < 1.2) {
          SonnerInfo(
            t("home.camera_no_zoom", {
              defaultValue: "Camera trước không hỗ trợ zoom 2x",
            }),
          );
          return;
        }
        setActiveZoomMode("2x");
        setZoomLevel("2x");
        lastZoomLevel.current = "2x";
        currentZoomValue.current = target;
        setCurrentZoom(target);
        try {
          await applyFrontCameraZoom(stream, target);
        } catch {
          /* ignore */
        }
        return;
      }
      return;
    }

    const cameras =
      detectedRef.current || (await getAvailableCameras({ force: false }));
    detectedRef.current = cameras;
    setDetectedCameras(cameras);
    const shape = toDetectedShape(cameras);

    // ── Siêu rộng = lens rộng nhất (live zoom.min), không hardcode 0.5 ──
    if (isWideZoomMode(mode)) {
      setIsSwitchingCamera(true);
      try {
        let detShape = shape;
        try {
          const fresh = await getAvailableCameras({ force: true });
          detectedRef.current = fresh;
          setDetectedCameras(fresh);
          detShape = toDetectedShape(fresh);
        } catch {
          /* keep shape */
        }
        // Pick widest FOV (physical ultra or digital min from capabilities)
        const result = await switchToWidestLens({
          oldStream: streamRef.current,
          videoEl: videoRef.current,
          detected: detShape,
        });
        if (result?.unavailable || !result?.stream) {
          SonnerInfo(
            t("home.zoom_05_unsupported", {
              defaultValue: "Máy không hỗ trợ góc siêu rộng",
            }),
          );
          return;
        }
        streamRef.current = result.stream;
        if (result.deviceId) {
          lastDeviceId.current = result.deviceId;
          setDeviceId(result.deviceId);
        }
        // Re-park at live min in case open path skipped apply
        try {
          await parkAtWidestTrackZoom(result.stream);
        } catch {
          /* ignore */
        }
        const live = readLiveZoomFromCamera(result.stream);
        const factor = resolveUltraWideFactor(
          result.stream,
          detShape,
          result.ultraFactor ??
            result.currentZoom ??
            live.current ??
            live.min,
        );
        setZoomLevel(WIDE_ZOOM_MODE);
        lastZoomLevel.current = WIDE_ZOOM_MODE;
        setActiveZoomMode(WIDE_ZOOM_MODE);
        currentZoomValue.current =
          factor != null ? factor : live.current ?? live.min ?? 1;
        setCurrentZoom(currentZoomValue.current);
        setCurrentLensType(result.lensType || "ultrawide");
        setAvailableZoomModes((prev) => ({
          ...(prev || {}),
          "0.5x": true,
          ultraFactor: factor,
        }));
        attachStreamToVideo(result.stream, "environment");
        syncZoomStateFromStream(
          result.stream,
          detectedRef.current || cameras,
          "environment",
        );
      } catch (e) {
        console.error("[widest]", e);
        SonnerInfo(
          t("home.zoom_05_unsupported", {
            defaultValue: "Không mở được góc siêu rộng",
          }),
        );
      } finally {
        setIsSwitchingCamera(false);
      }
      return;
    }

    const modes =
      availableZoomModes ||
      computeAvailableZoomModes(shape, streamRef.current);

    if (mode !== "1x" && modes[mode] === false) {
      SonnerInfo(
        t("home.zoom_2x_unsupported", {
          defaultValue: t("home.camera_no_zoom"),
        }),
      );
      return;
    }

    const target = resolveZoomModeTarget(mode, {
      detected: shape,
      stream: streamRef.current,
      facingMode:
        cameraMode === "environment" ? "environment" : "user",
    });

    if (target.unavailable) {
      SonnerInfo(
        t("home.camera_no_zoom", { defaultValue: t("home.camera_no_zoom") }),
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
      (mode === "0.5x"
        ? availableZoomModes?.ultraFactor ||
          getUltraWideFactor(streamRef.current, shape) ||
          0.6
        : mode === "2x"
          ? 2
          : 1);
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
    // Snap to live ultra factor (min from capabilities), never hard-code 0.5
    const uf =
      availableZoomModes?.ultraFactor ??
      (mn < 0.98 ? Math.round(mn * 10) / 10 : null);
    if (!isFront && uf && nextZoom < uf + 0.12 && mn <= uf + 0.05) {
      nextZoom = uf;
    }
    if (isFront && nextZoom < 1) nextZoom = 1;

    currentZoomValue.current = nextZoom;
    // Badge throttle — threshold from live factor / caps
    const wideSnap = wideBandThreshold(streamRef.current, uf);
    scheduleBadge(
      nextZoom,
      isFront
        ? Math.abs(nextZoom - 1) < 0.12
          ? "1x"
          : "custom"
        : nextZoom < wideSnap
          ? WIDE_ZOOM_MODE
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
    // After pinch: stay on current lens (esp. physical ultra).
    // Auto leave-UW on zoom≥0.92 was restarting stream → broken UW zoom.
    // Hop onto ultra only if still on main and user pinched into wide band.
    const liveId =
      getCurrentTrackSettings(streamRef.current)?.deviceId ||
      lastDeviceId.current ||
      deviceId;
    const ultraId = toDetectedShape(detectedRef.current)?.ultrawide?.deviceId;
    const onUltra = Boolean(ultraId && liveId && liveId === ultraId);
    const thr = wideBandThreshold(
      streamRef.current,
      availableZoomModes?.ultraFactor,
    );
    const wantHopToUltra =
      !onUltra && z < thr && Boolean(ultraId) && liveId !== ultraId;
    applyDisplayZoom(z, {
      force: true,
      allowLensSwitch: wantHopToUltra,
    }).catch(() => {});

    if (isFront) {
      if (Math.abs(z - 1) < 0.15) {
        setActiveZoomMode("1x");
        setZoomLevel("1x");
      } else {
        setActiveZoomMode("custom");
      }
      return;
    }
    const uf =
      availableZoomModes?.ultraFactor ??
      (Number.isFinite(z) && z < thr ? Math.round(z * 10) / 10 : null);
    if (uf && Math.abs(z - uf) < 0.12) {
      setActiveZoomMode(WIDE_ZOOM_MODE);
      setZoomLevel(WIDE_ZOOM_MODE);
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

  const attachStreamToVideo = (stream, wantFacing) => {
    const v = videoRef.current;
    if (!v || !stream) return;
    // Mirror chỉ khi cam trước (selfie) — theo facing thật của track
    let facing = wantFacing;
    try {
      facing =
        stream.getVideoTracks?.()?.[0]?.getSettings?.()?.facingMode ||
        wantFacing;
    } catch {
      /* keep */
    }
    const mirror = facing === "user";
    setPreviewMirror(mirror);
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

        let stream;
        try {
          // facingMode user only — không deviceId (tránh đảo cam)
          const front = await startFrontCamera({
            oldStream,
            videoEl: videoRef.current,
            deviceId: null,
            fast: true,
            stopFirst: true,
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

        attachStreamToVideo(stream, "user");

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
          displayZoom =
            target.displayZoom ??
            availableZoomModes?.ultraFactor ??
            getUltraWideFactor(streamRef.current, shape) ??
            0.6;
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

      // Flip: stop trước để mở rear ngay (không chờ dual stream)
      if (facingChanged && oldStream) {
        clearTrackZoomCache(oldStream);
        stopCurrentCamera(oldStream, null);
        streamRef.current = null;
      }

      // Flip / mở cam sau: facingMode environment trước (đúng cam)
      // deviceId chỉ khi đổi lens 0.5/2x (không flip)
      let stream;
      if (facingChanged || !resolvedDeviceId) {
        stream = await openCameraByFacing("environment", { fast: true });
      } else {
        stream = await startCameraByDeviceId(resolvedDeviceId, {
          facingMode: "environment",
          highRes: false,
          preferDeviceId: true,
          fast: false,
          facingOnly: false,
        });
      }

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

      attachStreamToVideo(stream, "environment");

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
                    // Front never shows ultra
                    if (
                      (cameraMode || "environment") === "user" &&
                      n < 1
                    )
                      return "1x";
                    return updateZoomBadge(n);
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

            {/* Manual rear lens pick — phones only, low confidence, top bar */}
            {showZoomUi && (cameraMode || "environment") !== "user" && (
              <RearLensPicker
                rearOptions={
                  availableZoomModes?.rearOptions ||
                  detectedCameras?.rearOptions ||
                  detectedCameras?.backCameras ||
                  detectedRef.current?.rearOptions ||
                  detectedRef.current?.backCameras ||
                  []
                }
                activeDeviceId={deviceId || lastDeviceId.current}
                visible={Boolean(
                  availableZoomModes?.needsManualLensPick ||
                    detectedCameras?.needsManualLensPick ||
                    detectedRef.current?.needsManualLensPick,
                )}
                disabled={isSwitchingCamera || isPinching}
                onSelect={async (id) => {
                  // Manual lens: stop main first (Samsung 1-cam), open exact id
                  if (!id || isSwitchingCamera) return;
                  setIsSwitchingCamera(true);
                  try {
                    const prev = streamRef.current;
                    if (prev) {
                      clearTrackZoomCache(prev);
                      stopCurrentCamera(prev, videoRef.current);
                    }
                    await new Promise((r) => setTimeout(r, 80));
                    const stream = await startCameraByDeviceId(id, {
                      facingMode: "environment",
                      forceDeviceId: true,
                      preferDeviceId: true,
                    });
                    streamRef.current = stream;
                    lastDeviceId.current = id;
                    setDeviceId(id);
                    setZoomLevel("0.5x");
                    lastZoomLevel.current = "0.5x";
                    setActiveZoomMode("0.5x");
                    const live = readLiveZoomFromCamera(stream);
                    currentZoomValue.current = live.current ?? live.min ?? 1;
                    setCurrentZoom(currentZoomValue.current);
                    setCurrentLensType("ultrawide");
                    attachStreamToVideo(stream, "environment");
                    syncZoomStateFromStream(
                      stream,
                      detectedRef.current || detectedCameras,
                      "environment",
                    );
                  } catch (e) {
                    console.warn("[lens-pick]", e?.message);
                    SonnerInfo(
                      t("home.zoom_05_unsupported", {
                        defaultValue: "Không mở được lens này",
                      }),
                    );
                  } finally {
                    setIsSwitchingCamera(false);
                  }
                }}
              />
            )}

            {/* Hàng nút zoom ấn — cam trước (1x·2x) + cam sau (UW·1x·2x) */}
            {showZoomUi && (
              <ZoomPresets
                activeMode={activeZoomMode}
                currentZoom={currentZoom}
                available={
                  (cameraMode || "environment") === "user"
                    ? {
                        "0.5x": false,
                        "1x": true,
                        "2x": true,
                        ultraFactor: null,
                      }
                    : availableZoomModes
                }
                facing={cameraMode || "environment"}
                disabled={isSwitchingCamera || isPinching}
                onSelect={handleSelectZoomMode}
                visible
              />
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
