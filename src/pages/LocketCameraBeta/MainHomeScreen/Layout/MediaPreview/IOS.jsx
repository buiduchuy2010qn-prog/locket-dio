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
  getLiveZoomDisplay,
  wideBandThreshold,
  applyLiveZoom,
  createLatestZoomApplier,
  isWideZoomMode,
  WIDE_ZOOM_MODE,
  parkAtWidestTrackZoom,
  isUltraZoomValue,
  applyTapToFocus,
  pointerToFocusPoint,
  rememberPreferredWideCameraId,
  BROWSER_HIDES_ULTRAWIDE_MSG,
  isCameraDebugEnabled,
  getLastRearProbeReport,
  logCameraPtz,
  isLiveVideoStream,
  ZOOM_APPLY_THROTTLE_MS,
  clampZoom,
  buildZoomContinuum,
  mapGlobalZoomToLens,
  continuumBounds,
  rememberLensZoomCaps,
  snapGlobalZoomOnRelease,
  isExactlyMainZoom,
  ensureCameraLensMapVersion,
  probeUltraBaseZoom,
  resolveUltraBaseZoom,
} from "@/utils";
const EditorCaption = lazy(() => import("@/features/EditorCaption"));
import { useApp } from "@/context/AppContext";
import BorderProgress from "../../Widgets/SquareProgress";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import { usePostStore, useUIStore } from "@/stores";
import { useTranslation } from "react-i18next";
import ZoomSlider from "./ZoomSlider";
import RearLensPicker from "./RearLensPicker";
import FocusReticle from "./FocusReticle";
import CameraDebugPanel from "./CameraDebugPanel";

const MediaPreviewIOS = () => {
  const { camera, navigation } = useApp();
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
    currentZoom,
    setCurrentZoom,
    currentLensType,
    setCurrentLensType,
    minZoom,
    setMinZoom,
    maxZoom,
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

  const cameraInitialized = useRef(false);
  const lastCameraMode = useRef(cameraMode);
  const lastDeviceId = useRef(deviceId);
  const lastZoomLevel = useRef(zoomLevel);
  const startRequestId = useRef(0);
  const pinchState = useRef({
    active: false,
    distance: 0,
    zoom: 1,
    isPinching: false,
  });
  const currentZoomValue = useRef(1);
  const appliedZoomRef = useRef(1);
  const displayZoomRaf = useRef(0);
  const pendingZoom = useRef(null);
  const applyInFlight = useRef(false);
  const detectedRef = useRef(null);
  const boundsRef = useRef({ minZoom: 1, maxZoom: 1 });
  const pinchingRef = useRef(false);
  const zoomGestureActiveRef = useRef(false);
  const switchSpinnerTimer = useRef(null);
  const zoomApplierRef = useRef(null);
  if (!zoomApplierRef.current) {
    zoomApplierRef.current = createLatestZoomApplier(
      () => streamRef.current,
      {
        minIntervalMs: ZOOM_APPLY_THROTTLE_MS,
        onApplied: (z) => {
          if (typeof z === "number" && Number.isFinite(z)) {
            appliedZoomRef.current = z;
          }
        },
      },
    );
  }
  const continuumRef = useRef(null);
  const stickyLensTypeRef = useRef("main");
  const lensSwitchInFlightRef = useRef(false);
  const pendingGlobalZoomRef = useRef(null);
  const continuumInitGen = useRef(0);
  const [zoomMarkers, setZoomMarkers] = useState([]);
  const [zoomRailReady, setZoomRailReady] = useState(false);

  const setDisplayZoomNow = useCallback(
    (z, modeHint) => {
      const n = Number(z);
      if (!Number.isFinite(n)) return;
      currentZoomValue.current = n;
      if (displayZoomRaf.current) cancelAnimationFrame(displayZoomRaf.current);
      displayZoomRaf.current = requestAnimationFrame(() => {
        displayZoomRaf.current = 0;
        setCurrentZoom(currentZoomValue.current);
        if (modeHint) setActiveZoomMode(modeHint);
      });
    },
    [setCurrentZoom, setActiveZoomMode],
  );

  const rebuildContinuum = useCallback(
    (stream, cameras, facing = "environment") => {
      const shape = toDetectedShape(cameras);
      if (stream) {
        const id = getCurrentTrackSettings(stream)?.deviceId;
        if (id) rememberLensZoomCaps(id, stream);
      }
      const cont = buildZoomContinuum(shape, stream, { facing });
      continuumRef.current = cont;
      if (cont.supported) {
        const next = continuumBounds(cont, boundsRef.current);
        const prevMin = boundsRef.current?.minZoom;
        const minZ =
          Number.isFinite(prevMin) && cont.minZoom < 0.98
            ? Math.min(prevMin, cont.minZoom)
            : cont.minZoom;
        boundsRef.current = {
          minZoom: minZ,
          maxZoom: Math.max(next.maxZoom, cont.maxZoom, 1),
        };
        setMinZoom(boundsRef.current.minZoom);
        setMaxZoom(boundsRef.current.maxZoom);
        setZoomMarkers(cont.markers || []);
        if (cont.ready !== false) setZoomRailReady(true);
      } else {
        setZoomMarkers([]);
      }
      return cont;
    },
    [setMinZoom, setMaxZoom],
  );

  const ensureContinuumCatalog = useCallback(
    async (stream, cameras) => {
      const gen = ++continuumInitGen.current;
      ensureCameraLensMapVersion();
      const shape = toDetectedShape(cameras);
      let cont = rebuildContinuum(stream, cameras, "environment");
      const ultraId = shape.ultrawide?.deviceId || null;
      const needsProbe =
        cont.needsUltraProbe ||
        (ultraId &&
          !resolveUltraBaseZoom(shape, stream, ultraId) &&
          cont.minZoom >= 0.98);

      if (needsProbe && ultraId && (cameraMode || "environment") !== "user") {
        setZoomRailReady(false);
        const freeze = captureVideoFreezeFrame(videoRef.current);
        if (freeze) setFreezeFrame(freeze);
        const mainId =
          shape.main?.deviceId ||
          shape.rear?.[0]?.deviceId ||
          lastDeviceId.current ||
          null;
        const old = streamRef.current;
        try {
          if (old) {
            clearTrackZoomCache(old);
            stopCurrentCamera(old, null);
            streamRef.current = null;
          }
          await probeUltraBaseZoom(ultraId, shape.ultrawide);
          if (gen !== continuumInitGen.current) return;
          const mainStream = await startCameraByDeviceId(mainId, {
            facingMode: "environment",
            highRes: false,
            preferDeviceId: Boolean(mainId),
          });
          if (gen !== continuumInitGen.current) {
            stopCurrentCamera(mainStream);
            return;
          }
          if (!isLiveVideoStream(mainStream)) {
            stopCurrentCamera(mainStream);
            setFreezeFrame(null);
            setZoomRailReady(true);
            return;
          }
          streamRef.current = mainStream;
          const mid =
            getCurrentTrackSettings(mainStream)?.deviceId || mainId;
          if (mid) {
            lastDeviceId.current = mid;
            setDeviceId(mid);
          }
          stickyLensTypeRef.current = "main";
          setCurrentLensType("main");
          attachStreamToVideo(mainStream, "environment");
          try {
            const range = readZoomRange(mainStream);
            const one =
              range.supported && range.minZoom <= 1 && range.maxZoom >= 1
                ? 1
                : range.minZoom || 1;
            await applyCameraZoom(mainStream, one);
          } catch {
            /* ignore */
          }
          cont = rebuildContinuum(mainStream, cameras, "environment");
        } catch (e) {
          console.warn("[zoom-ios] continuum catalog probe", e);
        } finally {
          if (gen === continuumInitGen.current) {
            setFreezeFrame(null);
            currentZoomValue.current = 1;
            appliedZoomRef.current = 1;
            setCurrentZoom(1);
            setActiveZoomMode("1x");
            lastZoomLevel.current = "1x";
            stickyLensTypeRef.current = "main";
            setZoomRailReady(true);
          }
        }
        return cont;
      }
      if (gen === continuumInitGen.current) {
        currentZoomValue.current = 1;
        setCurrentZoom(1);
        setActiveZoomMode("1x");
        setZoomRailReady(cont.ready !== false);
      }
      return cont;
    },
    [
      cameraMode,
      rebuildContinuum,
      setActiveZoomMode,
      setCurrentLensType,
      setCurrentZoom,
      setDeviceId,
    ],
  );

  const switchPhysicalLensForZoom = useCallback(
    async (targetDeviceId, targetType) => {
      if (!targetDeviceId || lensSwitchInFlightRef.current) return false;
      const curId =
        getCurrentTrackSettings(streamRef.current)?.deviceId ||
        lastDeviceId.current ||
        deviceId;
      if (curId && curId === targetDeviceId) return true;

      lensSwitchInFlightRef.current = true;
      setIsSwitchingCamera(true);
      try {
        const freeze = captureVideoFreezeFrame(videoRef.current);
        if (freeze) setFreezeFrame(freeze);

        const oldStream = streamRef.current;
        if (oldStream) {
          clearTrackZoomCache(oldStream);
          stopCurrentCamera(oldStream, null);
          streamRef.current = null;
        }

        const stream = await startCameraByDeviceId(targetDeviceId, {
          facingMode: "environment",
          highRes: false,
          preferDeviceId: true,
        });
        if (!isLiveVideoStream(stream)) {
          stopCurrentCamera(stream);
          setFreezeFrame(null);
          return false;
        }

        streamRef.current = stream;
        lastDeviceId.current = targetDeviceId;
        setDeviceId(targetDeviceId);
        stickyLensTypeRef.current = targetType || "main";
        setCurrentLensType(targetType || "main");
        attachStreamToVideo(stream, "environment");

        const v = videoRef.current;
        if (v) {
          await Promise.race([
            new Promise((resolve) => {
              const done = () => {
                v.removeEventListener("playing", done);
                v.removeEventListener("loadeddata", done);
                resolve();
              };
              v.addEventListener("playing", done);
              v.addEventListener("loadeddata", done);
            }),
            new Promise((r) => setTimeout(r, 700)),
          ]);
        }

        rebuildContinuum(
          stream,
          detectedRef.current || detectedCameras,
          "environment",
        );

        const latest =
          pendingGlobalZoomRef.current ?? currentZoomValue.current;
        pendingGlobalZoomRef.current = null;
        const mapped = mapGlobalZoomToLens(
          latest,
          continuumRef.current,
          targetDeviceId,
          stickyLensTypeRef.current,
        );
        if (mapped.localZoom != null) {
          zoomApplierRef.current?.request(mapped.localZoom);
          appliedZoomRef.current = mapped.localZoom;
        }
        setFreezeFrame(null);
        return true;
      } catch (e) {
        console.warn("[zoom-ios] physical lens switch failed", e);
        setFreezeFrame(null);
        return false;
      } finally {
        lensSwitchInFlightRef.current = false;
        setIsSwitchingCamera(false);
      }
    },
    [
      deviceId,
      detectedCameras,
      rebuildContinuum,
      setCurrentLensType,
      setDeviceId,
      setIsSwitchingCamera,
    ],
  );

  const requestUserZoom = useCallback(
    (raw, { modeHint, snap = false } = {}) => {
      const cont = continuumRef.current;
      const bounds = boundsRef.current;
      const mn = cont?.supported ? cont.minZoom : bounds?.minZoom ?? 1;
      const mx = cont?.supported ? cont.maxZoom : bounds?.maxZoom ?? 1;
      let next = clampZoom(raw, mn, mx);
      if (snap) {
        next = clampZoom(snapGlobalZoomOnRelease(next, cont), mn, mx);
      }

      currentZoomValue.current = next;
      pendingGlobalZoomRef.current = next;

      const gesturing = zoomGestureActiveRef.current && !snap;
      if (!gesturing) {
        const hint =
          modeHint ||
          (isExactlyMainZoom(next)
            ? "1x"
            : next < 0.92
              ? WIDE_ZOOM_MODE
              : "custom");
        setDisplayZoomNow(next, hint);
      } else if (isExactlyMainZoom(next)) {
        lastZoomLevel.current = "1x";
      }

      const liveId = lastDeviceId.current || deviceId;
      const mapped = mapGlobalZoomToLens(
        next,
        cont,
        liveId,
        stickyLensTypeRef.current,
      );

      if (
        mapped.switchDevice &&
        mapped.deviceId &&
        mapped.deviceId !== liveId &&
        (cameraMode || "environment") !== "user" &&
        !lensSwitchInFlightRef.current
      ) {
        stickyLensTypeRef.current = mapped.type || stickyLensTypeRef.current;
        void switchPhysicalLensForZoom(mapped.deviceId, mapped.type);
        return;
      }

      if (mapped.type && mapped.type !== stickyLensTypeRef.current) {
        stickyLensTypeRef.current = mapped.type;
        if (!gesturing) setCurrentLensType(mapped.type);
      }

      zoomApplierRef.current?.request(
        mapped.localZoom != null ? mapped.localZoom : next,
      );
    },
    [
      cameraMode,
      deviceId,
      setCurrentLensType,
      setDisplayZoomNow,
      switchPhysicalLensForZoom,
    ],
  );

  const [previewMirror, setPreviewMirror] = useState(
    () => cameraMode === "user",
  );
  const [freezeFrame, setFreezeFrame] = useState(null);
  const [videoEpoch, setVideoEpoch] = useState(0);
  const [forceRearLensPicker, setForceRearLensPicker] = useState(false);
  const [cameraDebug] = useState(() => isCameraDebugEnabled());
  const [probeRows, setProbeRows] = useState(() => getLastRearProbeReport());
  const [focusReticle, setFocusReticle] = useState(null);
  const frameRef = useRef(null);
  const tapStateRef = useRef(null);
  const focusInFlightRef = useRef(false);
  const focusSeqRef = useRef(0);
  const lastTouchFocusAt = useRef(0);
  const [pageVisible, setPageVisible] = useState(
    () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );

  const onCapturePage =
    !isBottomOpen && !isHomeOpen && !isProfileOpen && pageVisible;

  const cameraFrame = useUIStore((s) => s.cameraFrame);

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
          "3x": caps.supported && caps.maxZoom >= 2.7,
        });
        setCurrentLensType("front");
        stickyLensTypeRef.current = "main";
        rebuildContinuum(stream, cameras, "user");
        setZoomMarkers(
          caps.supported && caps.maxZoom > caps.minZoom + 0.01
            ? [{ zoom: 1, type: "main", label: "1", emphasis: true }]
            : [],
        );
        const z = Math.max(
          1,
          settingsZoomOr(stream, currentZoomValue.current),
        );
        currentZoomValue.current = z;
        setCurrentZoom(z);
        const actualId = getCurrentTrackSettings(stream).deviceId;
        if (actualId) lastDeviceId.current = actualId;
        return;
      }

      const cont = rebuildContinuum(stream, cameras, "environment");
      const bounds = cont.supported
        ? { minZoom: cont.minZoom, maxZoom: cont.maxZoom, step: 0.01 }
        : getEffectiveZoomBounds(shape, stream);
      const minZ = bounds.minZoom;
      boundsRef.current = {
        minZoom: minZ,
        maxZoom: Math.max(bounds.maxZoom, 1),
      };
      setMinZoom(boundsRef.current.minZoom);
      setMaxZoom(boundsRef.current.maxZoom);
      setZoomStep(bounds.step || 0.1);

      const settings = getCurrentTrackSettings(stream);
      const actualId = settings.deviceId || null;
      const device =
        cameras?.allCameras?.find((d) => d.deviceId === actualId) || null;
      let lensType = classifyLensType(device, shape);
      const ultraId = shape.ultrawide?.deviceId || null;
      const onUltra = ultraId && actualId && actualId === ultraId;
      if (!onUltra && (lastZoomLevel.current === "1x" || !lastZoomLevel.current)) {
        lensType = "main";
      }
      setCurrentLensType(lensType);
      if (lensType) stickyLensTypeRef.current = lensType;

      const modes = computeAvailableZoomModes(shape, stream);
      modes["1x"] = true;
      modes["0.5x"] = Boolean(
        cont.markers?.some((m) => m.type === "ultrawide") ||
          cont.minZoom < 0.98 ||
          ultraId,
      );
      modes.ultraFactor =
        resolveUltraBaseZoom(shape, stream, ultraId) ||
        modes.ultraFactor ||
        getUltraWideFactor(stream, shape) ||
        null;
      setAvailableZoomModes(modes);

      if (
        !onUltra &&
        (lastZoomLevel.current === "1x" ||
          isExactlyMainZoom(currentZoomValue.current) ||
          stickyLensTypeRef.current === "main")
      ) {
        currentZoomValue.current = 1;
        setCurrentZoom(1);
        setActiveZoomMode("1x");
        lastZoomLevel.current = "1x";
        stickyLensTypeRef.current = "main";
      } else {
        const disp = getLiveZoomDisplay(stream, {
          lensType,
          detected: shape,
          preferredMode: lastZoomLevel.current,
          uiZoom: currentZoomValue.current,
        });
        if (disp.value != null && Number.isFinite(disp.value)) {
          currentZoomValue.current = disp.value;
          setCurrentZoom(disp.value);
        }
      }
      if (actualId) lastDeviceId.current = actualId;
    },
    [
      rebuildContinuum,
      setActiveZoomMode,
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

  /**
   * Continuum zoom — at ~1x always force main (never leave stream on UW).
   */
  const applyDisplayZoom = useCallback(
    async (displayZoom, { force = false, allowLensSwitch = true } = {}) => {
      const stream = streamRef.current;
      if (!stream) return false;

      const isFront = (cameraMode || "user") === "user";
      const canSwitchLens =
        allowLensSwitch && !isSwitchingCamera;

      // ── FRONT: no 0.5, no lens switch, only front track zoom ──
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
        setCurrentZoom(clamped);
        setActiveZoomMode(Math.abs(clamped - 1) < 0.12 ? "1x" : "custom");
        if (Math.abs(clamped - 1) < 0.12) {
          lastZoomLevel.current = "1x";
        }
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
      const cont =
        continuumRef.current ||
        rebuildContinuum(stream, cameras, "environment");
      const { minZoom: mn, maxZoom: mx } = continuumBounds(
        cont,
        boundsRef.current,
      );
      boundsRef.current = { minZoom: mn, maxZoom: mx };
      const clamped = clampZoom(Number(displayZoom) || 1, mn, mx);

      currentZoomValue.current = clamped;
      setCurrentZoom(clamped);

      let mode = "custom";
      if (isExactlyMainZoom(clamped)) mode = "1x";
      else if (clamped < 0.92) mode = WIDE_ZOOM_MODE;
      else if (clamped >= 1.7) mode = "2x";
      setActiveZoomMode(mode);
      if (mode === WIDE_ZOOM_MODE || mode === "1x") {
        lastZoomLevel.current = mode;
      }

      const settings = getCurrentTrackSettings(stream);
      const actualId =
        settings.deviceId || lastDeviceId.current || deviceId || null;
      const mapped = mapGlobalZoomToLens(
        clamped,
        cont,
        actualId,
        stickyLensTypeRef.current,
      );

      if (
        canSwitchLens &&
        mapped.switchDevice &&
        mapped.deviceId &&
        mapped.deviceId !== actualId
      ) {
        if (!force && isSwitchingCamera) return false;
        stickyLensTypeRef.current = mapped.type || stickyLensTypeRef.current;
        setCurrentLensType(mapped.type || "main");
        if (isExactlyMainZoom(clamped)) {
          setZoomLevel("1x");
          setActiveZoomMode("1x");
          lastZoomLevel.current = "1x";
        }
        setIsSwitchingCamera(true);
        setDeviceId(mapped.deviceId);
        return true;
      }

      const digi =
        mapped.localZoom != null ? mapped.localZoom : clamped;

      if (supportsHardwareZoom(stream)) {
        if (applyInFlight.current && !force) {
          pendingZoom.current = digi;
          return false;
        }
        applyInFlight.current = true;
        try {
          const applied = await applyLiveZoom(stream, digi);
          if (applied !== false) {
            if (mapped.type) setCurrentLensType(mapped.type);
            stickyLensTypeRef.current =
              mapped.type || stickyLensTypeRef.current;
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

      if (clamped < 0.9 && !window.__zoom05Toast) {
        window.__zoom05Toast = true;
        SonnerInfo(
          t("home.zoom_05_unsupported", {
            defaultValue: "0.5x is not supported on this device",
          }),
        );
        setTimeout(() => {
          window.__zoom05Toast = false;
        }, 4000);
      }

      return false;
    },
    [
      cameraMode,
      deviceId,
      isSwitchingCamera,
      setActiveZoomMode,
      setCurrentLensType,
      setCurrentZoom,
      setDeviceId,
      setIsSwitchingCamera,
      setZoomLevel,
      rebuildContinuum,
      t,
    ],
  );

  const handleSelectZoomMode = async (mode) => {
    if (isSwitchingCamera || isPinching) return;

    // Cam trước: nút 1x / 2x — không 0.5x
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

    // Siêu rộng = shared multi-platform path (logical zoom.min · physical deviceId)
    // Same as Android — no hard-coded 0.5/0.6; Safari often lacks caps.zoom.
    if (isWideZoomMode(mode)) {
      setIsSwitchingCamera(true);
      try {
        const detShape = shape;
        const multiRear = (detShape.rear?.length || 0) >= 2;
        setForceRearLensPicker(multiRear || cameraDebug);
        // Do NOT force getAvailableCameras probe here — steals camera slot.
        const result = await switchToWidestLens({
          oldStream: streamRef.current,
          videoEl: videoRef.current,
          detected: detShape,
        });

        if (Array.isArray(result?.probeRows)) {
          setProbeRows(result.probeRows);
        }
        if (result?.detected) {
          const merged = {
            ...(detectedRef.current || cameras || {}),
            backCameras: result.detected.rear || detShape.rear,
            rearOptions: result.detected.rearOptions || result.detected.rear,
            backUltraWideCamera: result.detected.ultrawide,
            needsManualLensPick:
              result.forceLensPicker ||
              result.detected.needsManualLensPick ||
              multiRear,
          };
          detectedRef.current = { ...detectedRef.current, ...merged };
          setDetectedCameras((prev) => ({ ...(prev || {}), ...merged }));
        }

        if (result?.stream && isLiveVideoStream(result.stream)) {
          streamRef.current = result.stream;
        }

        if (result?.unavailable || !isLiveVideoStream(result?.stream)) {
          setForceRearLensPicker(
            multiRear ||
              result?.forceLensPicker ||
              result?.reason === "needs-manual-lens" ||
              cameraDebug,
          );
          const msg =
            result?.message ||
            (result?.reason === "browser-hides-ultrawide"
              ? BROWSER_HIDES_ULTRAWIDE_MSG
              : result?.reason === "needs-manual-lens"
                ? "Chọn camera trong danh sách Lens — trình duyệt không gắn nhãn siêu rộng."
                : "Không mở được góc siêu rộng. Thử chọn camera trong danh sách Lens.");
          SonnerInfo(
            t("home.zoom_05_unsupported", { defaultValue: msg }),
          );
          if (isLiveVideoStream(streamRef.current)) {
            attachStreamToVideo(streamRef.current, "environment");
          }
          return;
        }

        streamRef.current = result.stream;
        if (result.deviceId) {
          lastDeviceId.current = result.deviceId;
          setDeviceId(result.deviceId);
        }
        try {
          // Only parks when capabilities.zoom.min is real (no-op if no zoom API)
          await parkAtWidestTrackZoom(result.stream);
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, 100));
        if (!isLiveVideoStream(result.stream)) {
          setForceRearLensPicker(multiRear || cameraDebug);
          SonnerInfo(
            t("home.zoom_05_unsupported", {
              defaultValue: BROWSER_HIDES_ULTRAWIDE_MSG,
            }),
          );
          return;
        }
        const live = readLiveZoomFromCamera(result.stream);
        const lensType = result.lensType || "ultrawide";
        setZoomLevel(WIDE_ZOOM_MODE);
        lastZoomLevel.current = WIDE_ZOOM_MODE;
        setActiveZoomMode(WIDE_ZOOM_MODE);
        setCurrentLensType(lensType);
        const disp = getLiveZoomDisplay(result.stream, {
          lensType,
          detected: detShape,
          preferredMode: WIDE_ZOOM_MODE,
          uiZoom:
            result.ultraFactor ??
            result.currentZoom ??
            live.current ??
            live.min,
        });
        if (disp.value != null && Number.isFinite(disp.value)) {
          currentZoomValue.current = disp.value;
          setCurrentZoom(disp.value);
        } else {
          const base =
            typeof live.current === "number" && Number.isFinite(live.current)
              ? live.current
              : 1;
          currentZoomValue.current = base;
          setCurrentZoom(base);
        }
        setAvailableZoomModes((prev) => ({
          ...(prev || {}),
          "0.5x": true,
          ultraFactor: disp.ultraFactor,
          rearOptions:
            result.detected?.rearOptions ||
            result.detected?.rear ||
            prev?.rearOptions,
          needsManualLensPick:
            result.forceLensPicker || multiRear || prev?.needsManualLensPick,
        }));
        if (result.forceLensPicker || multiRear) {
          setForceRearLensPicker(true);
        }
        attachStreamToVideo(result.stream, "environment");
        syncZoomStateFromStream(
          result.stream,
          detectedRef.current || cameras,
          "environment",
        );
        logCameraPtz({
          action: "ui-uw-applied",
          selectedDeviceId: result.deviceId || null,
          settingsZoom: live.current,
          capabilitiesZoom: live.supported
            ? { min: live.min, max: live.max }
            : null,
          trackState: "live",
          applyResult: disp.ultraFactor ?? disp.label,
          path: result.selectionPath || null,
        });
      } catch (e) {
        console.error("[camera-ptz] iOS", e?.name, e?.message, e);
        setForceRearLensPicker((shape.rear?.length || 0) >= 2 || cameraDebug);
        SonnerInfo(
          t("home.zoom_05_unsupported", {
            defaultValue: BROWSER_HIDES_ULTRAWIDE_MSG,
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
          0.5
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

  const runTapFocus = useCallback(
    async (clientX, clientY) => {
      if (preview || selectedFile || !cameraActive) return;
      if (isSwitchingCamera || pinchingRef.current) return;
      if (focusInFlightRef.current) return;

      const point = pointerToFocusPoint(
        frameRef.current,
        videoRef.current,
        clientX,
        clientY,
        { mirrored: previewMirror },
      );
      if (!point) return;

      const seq = ++focusSeqRef.current;
      setFocusReticle({
        x: point.px,
        y: point.py,
        key: seq,
        success: true,
      });

      focusInFlightRef.current = true;
      try {
        // Best-effort HW focus/metering — reticle always shows (native-cam UX).
        await applyTapToFocus(streamRef.current, point.x, point.y);
      } finally {
        focusInFlightRef.current = false;
      }
    },
    [
      preview,
      selectedFile,
      cameraActive,
      isSwitchingCamera,
      previewMirror,
      streamRef,
      videoRef,
    ],
  );

  const onTouchStart = (event) => {
    if (preview || selectedFile) return;

    if (event.touches.length === 2) {
      tapStateRef.current = null;
      event.preventDefault();
      pinchingRef.current = true;
      const isFront = (cameraMode || "user") === "user";
      const state = isFront
        ? handleFrontCameraPinchStart(event.touches, currentZoomValue.current)
        : handlePinchZoomStart(event.touches, currentZoomValue.current);
      pinchState.current = state;
      setIsPinching(true);
      return;
    }

    if (event.touches.length === 1) {
      const t = event.touches[0];
      const el = t.target;
      if (
        el?.closest?.(
          "button, a, input, [data-no-focus], [data-zoom-badge]",
        )
      ) {
        tapStateRef.current = null;
        return;
      }
      tapStateRef.current = {
        x: t.clientX,
        y: t.clientY,
        t: Date.now(),
        moved: false,
      };
    }
  };

  const onTouchMove = (event) => {
    if (tapStateRef.current && event.touches.length === 1) {
      const t = event.touches[0];
      const dx = t.clientX - tapStateRef.current.x;
      const dy = t.clientY - tapStateRef.current.y;
      if (dx * dx + dy * dy > 14 * 14) {
        tapStateRef.current.moved = true;
      }
    }

    if (!pinchState.current.active || event.touches.length !== 2) return;
    if (isSwitchingCamera) return;
    event.preventDefault();
    // No UI throttle — displayZoom every move; HW is latest-wins

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
    if (totalScale < 1) totalScale = Math.pow(totalScale, isFront ? 1.15 : 1.25);
    else if (totalScale > 1) totalScale = Math.pow(totalScale, 1.12);

    let nextZoom = clampZoom(startZoom * totalScale, mn, mx);
    const uf =
      availableZoomModes?.ultraFactor ?? (mn < 0.98 ? mn : null);
    if (isFront && nextZoom < 1) nextZoom = 1;

    const wideSnap =
      uf != null && uf < 0.98 ? (Number(uf) + 1) / 2 : 0.92;
    const modeHint = isFront
      ? Math.abs(nextZoom - 1) < 0.12
        ? "1x"
        : "custom"
      : nextZoom < wideSnap
        ? WIDE_ZOOM_MODE
        : "custom";

    zoomGestureActiveRef.current = true;
    requestUserZoom(nextZoom, { modeHint });
  };

  const onTouchEnd = (event) => {
    const tap = tapStateRef.current;
    if (
      tap &&
      !tap.moved &&
      !pinchingRef.current &&
      !pinchState.current.active &&
      Date.now() - tap.t < 450
    ) {
      tapStateRef.current = null;
      if (!event?.touches?.length) {
        lastTouchFocusAt.current = Date.now();
        runTapFocus(tap.x, tap.y);
      }
    } else {
      tapStateRef.current = null;
    }

    if (!pinchState.current.active && !isPinching) return;
    const isFront = (cameraMode || "user") === "user";
    pinchingRef.current = false;
    zoomGestureActiveRef.current = false;
    pinchState.current = {
      ...(isFront ? handleFrontCameraPinchEnd() : handlePinchZoomEnd()),
      zoom: currentZoomValue.current,
    };
    setIsPinching(false);

    const z = currentZoomValue.current;
    setCurrentZoom(z);
    zoomApplierRef.current?.request(z);
    try {
      const stream = streamRef.current;
      const liveId =
        getCurrentTrackSettings(stream)?.deviceId ||
        lastDeviceId.current ||
        deviceId;
      const ultraId = toDetectedShape(detectedRef.current)?.ultrawide?.deviceId;
      const onUltra = Boolean(ultraId && liveId && liveId === ultraId);
      const thr = wideBandThreshold(
        stream,
        availableZoomModes?.ultraFactor,
      );
      const wantHopToUltra =
        !isFront &&
        !onUltra &&
        z < thr &&
        Boolean(ultraId) &&
        liveId !== ultraId;
      if (wantHopToUltra) {
        applyDisplayZoom(z, {
          force: true,
          allowLensSwitch: true,
        }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
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
    currentZoomValue.current = 1;
    setCurrentZoom(1);
    setActiveZoomMode("1x");
  };

  const attachStreamToVideo = (stream, wantFacing) => {
    const v = videoRef.current;
    if (!v || !stream) return;
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
      ? "translateZ(0) scaleX(-1)"
      : "translateZ(0)";
    const clearFreeze = () => setFreezeFrame(null);
    v.addEventListener("playing", clearFreeze, { once: true });
    v.addEventListener("loadeddata", clearFreeze, { once: true });
    setTimeout(clearFreeze, 600);
    v.play().catch(() => {});
  };

  const startCamera = async () => {
    ensureCameraLensMapVersion();
    const requestId = startRequestId.current + 1;
    startRequestId.current = requestId;
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

      if (facingChanged && videoRef.current) {
        const freeze = captureVideoFreezeFrame(videoRef.current);
        if (freeze) setFreezeFrame(freeze);
      }

      // ── FRONT ──
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
          console.error("startFrontCamera iOS:", e);
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

      // ── REAR ──
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
            0.5;
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

      if (facingChanged && oldStream) {
        clearTrackZoomCache(oldStream);
        stopCurrentCamera(oldStream, null);
        streamRef.current = null;
      }

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
        if (z === "1x" || !z) {
          const range = readZoomRange(stream);
          const one =
            range.minZoom <= 1 && range.maxZoom >= 1 ? 1 : range.minZoom;
          applyCameraZoom(stream, one).catch(() => {});
          displayZoom = 1;
        } else if (digitalZoomTarget != null) {
          applyCameraZoom(stream, digitalZoomTarget).catch(() => {});
        }
      }

      if (z === "1x" || !z) {
        displayZoom = 1;
        stickyLensTypeRef.current = "main";
        lastZoomLevel.current = "1x";
      }
      currentZoomValue.current = displayZoom;
      setCurrentZoom(displayZoom);
      setActiveZoomMode(z === "0.5x" || z === "2x" || z === "1x" ? z : "1x");
      syncZoomStateFromStream(stream, cameras, "environment");
      void ensureContinuumCatalog(stream, cameras);
    } catch (err) {
      console.error("startCamera iOS:", err);
      cameraInitialized.current = false;
      setFreezeFrame(null);
    } finally {
      setIsSwitchingCamera(false);
    }
  };

  useEffect(() => {
    removeCaptionZoomControls();
    warmCameraList().catch(() => {});
  }, []);

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

  const showCameraUi = !preview && !selectedFile && cameraActive;
  const showZoomUi = showCameraUi;

  const onFrameClick = (event) => {
    if (preview || selectedFile || !cameraActive) return;
    if (Date.now() - lastTouchFocusAt.current < 700) return;
    if (event.detail === 0) return;
    const el = event.target;
    if (el?.closest?.("button, a, input, [data-no-focus]")) return;
    runTapFocus(event.clientX, event.clientY);
  };

  return (
    <>
      <div
        ref={frameRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={(e) => {
          tapStateRef.current = null;
          onTouchEnd(e);
        }}
        onClick={onFrameClick}
        className="relative w-full max-w-md aspect-square bg-gray-800 rounded-[65px] overflow-hidden transition-transform duration-500"
        style={{
          touchAction: preview || selectedFile ? "auto" : "none",
        }}
      >
        {!preview && !selectedFile && cameraActive && (
          <video
            key={`ios-cam-${videoEpoch}`}
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

        {/* Freeze frame khi flip — không màn đen / spinner */}
        {freezeFrame && showCameraUi && !preview && !selectedFile && (
          <img
            src={freezeFrame}
            alt=""
            className="absolute inset-0 z-30 w-full h-full object-cover pointer-events-none"
            style={{
              transform: previewMirror
                ? "translateZ(0) scaleX(-1)"
                : "translateZ(0)",
            }}
            draggable={false}
          />
        )}

        {showCameraUi && focusReticle && (
          <FocusReticle
            key={focusReticle.key}
            x={focusReticle.x}
            y={focusReticle.y}
            show
            success={focusReticle.success !== false}
          />
        )}

        {showCameraUi && (
          <>
            <div className="absolute top-7 left-7 z-30 pointer-events-none flex items-center gap-2">
              <button
                onClick={() => SonnerInfo(t("home.feature_coming_soon"))}
                data-no-focus
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
                    if ((cameraMode || "environment") === "user") {
                      return updateZoomBadge(
                        Number.isFinite(n) && n >= 1 ? n : 1,
                      );
                    }
                    if (
                      zoomGestureActiveRef.current ||
                      isPinching ||
                      pinchingRef.current
                    ) {
                      return updateZoomBadge(
                        Number.isFinite(n) && n > 0 ? n : 1,
                      );
                    }
                    if (
                      isWideZoomMode(activeZoomMode) &&
                      (!Number.isFinite(n) || n >= 0.98) &&
                      availableZoomModes?.ultraFactor == null
                    ) {
                      return "UW";
                    }
                    return updateZoomBadge(
                      Number.isFinite(n) && n > 0 ? n : 1,
                    );
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

            {/* Manual rear lens pick — PRODUCTION HIDDEN; only ?cameraDebug=1 */}
            {showZoomUi &&
              cameraDebug &&
              (cameraMode || "environment") !== "user" && (
              <RearLensPicker
                rearOptions={
                  availableZoomModes?.rearOptions ||
                  detectedCameras?.rearOptions ||
                  detectedCameras?.backCameras ||
                  detectedRef.current?.rearOptions ||
                  detectedRef.current?.backCameras ||
                  []
                }
                ultraDeviceId={
                  detectedCameras?.backUltraWideCamera?.deviceId ||
                  detectedRef.current?.backUltraWideCamera?.deviceId ||
                  null
                }
                activeDeviceId={deviceId || lastDeviceId.current}
                visible
                disabled={isSwitchingCamera || isPinching}
                onSelectAuto={async () => {
                  if (isSwitchingCamera) return false;
                  await handleSelectZoomMode(WIDE_ZOOM_MODE);
                  return true;
                }}
                onSelect={async (id) => {
                  if (!id || isSwitchingCamera) return false;
                  setIsSwitchingCamera(true);
                  try {
                    const prev = streamRef.current;
                    if (prev) {
                      clearTrackZoomCache(prev);
                      stopCurrentCamera(prev, videoRef.current);
                    }
                    await new Promise((r) => setTimeout(r, 120));
                    const stream = await startCameraByDeviceId(id, {
                      facingMode: "environment",
                      forceDeviceId: true,
                      preferDeviceId: true,
                    });
                    if (!isLiveVideoStream(stream)) {
                      stopCurrentCamera(stream);
                      throw new Error("track-not-live");
                    }
                    const actualId = getCurrentTrackSettings(stream)?.deviceId;
                    streamRef.current = stream;
                    const selectedId = actualId || id;
                    lastDeviceId.current = selectedId;
                    setDeviceId(selectedId);
                    try {
                      await parkAtWidestTrackZoom(stream);
                    } catch {
                      /* no zoom API on this lens */
                    }
                    if (!isLiveVideoStream(stream)) {
                      throw new Error("track-ended-after-park");
                    }
                    setZoomLevel(WIDE_ZOOM_MODE);
                    lastZoomLevel.current = WIDE_ZOOM_MODE;
                    setActiveZoomMode(WIDE_ZOOM_MODE);
                    const live = readLiveZoomFromCamera(stream);
                    const disp = getLiveZoomDisplay(stream, {
                      lensType: "ultrawide",
                      detected: toDetectedShape(
                        detectedRef.current || detectedCameras,
                      ),
                      preferredMode: WIDE_ZOOM_MODE,
                      uiZoom: live.current ?? live.min,
                    });
                    currentZoomValue.current =
                      disp.value ?? live.current ?? live.min ?? 1;
                    setCurrentZoom(currentZoomValue.current);
                    setCurrentLensType("ultrawide");
                    setAvailableZoomModes((prev) => ({
                      ...(prev || {}),
                      "0.5x": true,
                      ultraFactor: disp.ultraFactor ?? prev?.ultraFactor ?? null,
                    }));
                    rememberPreferredWideCameraId(selectedId);
                    setForceRearLensPicker(true);
                    attachStreamToVideo(stream, "environment");
                    syncZoomStateFromStream(
                      stream,
                      detectedRef.current || detectedCameras,
                      "environment",
                    );
                    logCameraPtz({
                      action: "manual-lens-pick",
                      selectedDeviceId: selectedId,
                      settingsZoom: live.current,
                      trackState: "live",
                      applyResult: disp.ultraFactor ?? disp.label,
                    });
                    return true;
                  } catch (e) {
                    logCameraPtz({
                      action: "manual-lens-pick",
                      selectedDeviceId: id,
                      applyResult: "error",
                      errorName: e?.name || null,
                      errorMessage: e?.message || String(e),
                    });
                    SonnerInfo(
                      t("home.zoom_05_unsupported", {
                        defaultValue: "Không mở được lens này",
                      }),
                    );
                    return false;
                  } finally {
                    setIsSwitchingCamera(false);
                  }
                }}
              />
            )}

            {cameraDebug && showZoomUi && (
              <CameraDebugPanel
                streamRef={streamRef}
                videoRef={videoRef}
                visible
                onProbeDone={(result) => {
                  if (Array.isArray(result?.rows)) setProbeRows(result.rows);
                  if (
                    result?.best?.stream &&
                    isLiveVideoStream(result.best.stream)
                  ) {
                    streamRef.current = result.best.stream;
                    const id =
                      result.best.deviceId ||
                      getCurrentTrackSettings(result.best.stream)?.deviceId;
                    if (id) {
                      lastDeviceId.current = id;
                      setDeviceId(id);
                    }
                    attachStreamToVideo(result.best.stream, "environment");
                    syncZoomStateFromStream(
                      result.best.stream,
                      detectedRef.current || detectedCameras,
                      "environment",
                    );
                  }
                }}
              />
            )}

            {/* Single continuous zoom rail — disabled until catalog ready */}
            {showZoomUi && Number(maxZoom) > Number(minZoom) + 0.01 && (
              <ZoomSlider
                min={minZoom}
                max={maxZoom}
                value={currentZoom}
                markers={
                  (cameraMode || "environment") === "user"
                    ? [{ zoom: 1, type: "main", label: "1", emphasis: true }]
                    : zoomMarkers
                }
                disabled={
                  (cameraMode || "environment") !== "user" && !zoomRailReady
                }
                visible
                onInputValue={(z) => {
                  if (
                    (cameraMode || "environment") !== "user" &&
                    !zoomRailReady
                  )
                    return;
                  zoomGestureActiveRef.current = true;
                  requestUserZoom(z);
                }}
                onGestureEnd={() => {
                  zoomGestureActiveRef.current = false;
                  requestUserZoom(currentZoomValue.current, { snap: true });
                }}
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
            style={{ imageRendering: "auto", WebkitUserDrag: "none" }}
          />
        )}

        {/* Caption ONLY — never put zoom controls here */}
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

export default MediaPreviewIOS;
