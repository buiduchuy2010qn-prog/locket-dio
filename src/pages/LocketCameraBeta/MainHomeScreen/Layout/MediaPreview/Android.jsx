import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  getAvailableCameras,
  pickCameraDeviceId,
  isDeviceUltraWide,
  getMainBackCameraId,
} from "@/utils";
const EditorCaption = lazy(() => import("@/features/EditorCaption"));
import { useApp } from "@/context/AppContext";
import { CONFIG } from "@/config";
import BorderProgress from "../../Widgets/SquareProgress";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { usePostStore, useUIStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { getCameraPreviewConstraints } from "@/utils/device/perfProfile";

const MediaPreviewAndroid = () => {
  const { useloading, camera, navigation } = useApp();
  const { t } = useTranslation("main");
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

  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);
  const videoCropData = usePostStore((s) => s.videoCropData);

  const cameraInitialized = useRef(false);
  const lastCameraMode = useRef(cameraMode);
  const lastDeviceId = useRef(deviceId);
  const lastZoomLevel = useRef(zoomLevel);
  const startRequestId = useRef(0);
  const startingRef = useRef(false);
  const pinchState = useRef({ active: false, distance: 0, zoom: 1 });
  const currentZoomValue = useRef(1);
  const lastPinchUpdate = useRef(0);
  const [pageVisible, setPageVisible] = useState(
    () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );

  // Chỉ bật cam khi đang ở trang chụp (không xem bài / chat / profile / tab ẩn)
  const onCapturePage =
    !isBottomOpen && !isHomeOpen && !isProfileOpen && pageVisible;

  const cameraFrame = useUIStore((s) => s.cameraFrame);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomOptions, setZoomOptions] = useState(["1x"]);
  const [zoomDisplay, setZoomDisplay] = useState("1x");
  /** Lens pills: luôn có 0.5 / 1 / 2 khi camera sau (nếu máy hỗ trợ) */
  const [lensPills, setLensPills] = useState(["1x"]);

  const getActiveTrack = (stream = streamRef.current) =>
    stream?.getVideoTracks?.()?.[0] || null;

  const getTrackCapabilities = (track) => track?.getCapabilities?.() || {};

  const formatZoomDisplay = (value) => `${Number(value.toFixed(1))}x`;

  /** Mức zoom theo hardware track (min/max) + lens vật lý */
  const getZoomLabels = (capabilities) => {
    const minZoom = capabilities?.zoom?.min ?? 1;
    const maxZoom = capabilities?.zoom?.max ?? 1;
    const labels = [];

    if (minZoom < 0.9) labels.push("0.5x");
    labels.push("1x");
    if (maxZoom >= 1.8) labels.push("2x");
    if (maxZoom >= 2.5) labels.push("3x");
    if (maxZoom >= 4.5) labels.push("5x");

    return [...new Set(labels)];
  };

  const getZoomValue = (label, capabilities) => {
    const minZoom = capabilities?.zoom?.min ?? 1;
    const maxZoom = capabilities?.zoom?.max ?? 1;
    const map = {
      "0.5x": 0.5,
      "1x": 1,
      "2x": 2,
      "3x": 3,
      "5x": 5,
    };
    const target = map[label] ?? 1;
    return Math.max(minZoom, Math.min(target, maxZoom));
  };

  const getNearestZoomLabel = (value, capabilities) => {
    const supportedZoomOptions = getZoomLabels(capabilities);

    if (!supportedZoomOptions.length) {
      return "1x";
    }

    return supportedZoomOptions.reduce((closest, label) => {
      const closestDistance = Math.abs(
        getZoomValue(closest, capabilities) - value
      );
      const nextDistance = Math.abs(getZoomValue(label, capabilities) - value);

      return nextDistance < closestDistance ? label : closest;
    }, supportedZoomOptions[0]);
  };

  const applyZoomValue = async (value, stream = streamRef.current) => {
    const track = getActiveTrack(stream);
    const capabilities = getTrackCapabilities(track);

    if (!track || !capabilities.zoom) {
      return false;
    }

    const nextZoomValue = Math.max(
      capabilities.zoom.min,
      Math.min(value, capabilities.zoom.max)
    );

    await track.applyConstraints({
      advanced: [{ zoom: nextZoomValue }],
    });

    currentZoomValue.current = nextZoomValue;
    setZoomDisplay(formatZoomDisplay(nextZoomValue));

    const nextZoomLabel = getNearestZoomLabel(nextZoomValue, capabilities);
    if (nextZoomLabel !== zoomLevel) {
      setZoomLevel(nextZoomLabel);
    }

    return true;
  };

  const applyZoomLevel = async (label, stream = streamRef.current) => {
    const track = getActiveTrack(stream);
    const capabilities = getTrackCapabilities(track);

    if (!track || !capabilities.zoom) {
      return false;
    }

    return applyZoomValue(getZoomValue(label, capabilities), stream);
  };

  const applyTorchState = async (enabled, stream = streamRef.current) => {
    const track = getActiveTrack(stream);
    const capabilities = getTrackCapabilities(track);

    if (!track || !capabilities.torch) {
      return false;
    }

    await track.applyConstraints({ advanced: [{ torch: enabled }] });
    return true;
  };

  /** Full zoom pills: 0.5 / 1 / 2 / 3 / 5 theo lens + digital zoom máy */
  const refreshLensPills = async (stream) => {
    const track = getActiveTrack(stream);
    const capabilities = getTrackCapabilities(track);
    const fromTrack = getZoomLabels(capabilities);
    const pills = new Set(fromTrack.length ? fromTrack : ["1x"]);

    // Luôn có 1x; 0.5 nếu ultra-wide vật lý (kể cả khi track min=1)
    pills.add("1x");
    try {
      const cameras = await getAvailableCameras();
      if (cameras?.backUltraWideCamera) pills.add("0.5x");
      if (cameras?.backZoomCamera) {
        pills.add("3x");
        // tele máy thường ≥3; digital 2x vẫn hữu ích trên main
        pills.add("2x");
      }
      // Camera sau: nếu track hỗ trợ zoom cao
      if ((capabilities?.zoom?.max ?? 1) >= 1.8) pills.add("2x");
      if ((capabilities?.zoom?.max ?? 1) >= 2.5) pills.add("3x");
      if ((capabilities?.zoom?.max ?? 1) >= 4.5) pills.add("5x");
    } catch {
      /* optional */
    }

    const order = ["0.5x", "1x", "2x", "3x", "5x"];
    const list = order.filter((z) => pills.has(z));
    // Tối thiểu 0.5 + 1 nếu máy có ultra; không thì 1x
    setLensPills(list.length ? list : ["1x"]);
    setZoomOptions(fromTrack.length ? fromTrack : ["1x"]);
  };

  /** Nhẹ — không setState zoom (tránh re-start camera) */
  const syncTrackFeatures = async (stream) => {
    const track = getActiveTrack(stream);
    const capabilities = getTrackCapabilities(track);

    setTorchSupported(Boolean(capabilities.torch));
    if (!capabilities.torch) setTorchEnabled(false);

    // Lens pills: defer — không chặn frame đầu
    setTimeout(() => {
      refreshLensPills(stream).catch(() => {});
    }, 0);

    if (!capabilities.zoom) {
      currentZoomValue.current = 1;
      setZoomDisplay(zoomLevel === "0.5x" ? "0.5x" : "1x");
      return;
    }

    const z = zoomLevel || "1x";
    // Chỉ applyConstraints khi user cần zoom ≠ 1 (mặc định track đã ~1x)
    if (z === "2x" || z === "3x" || z === "0.5x") {
      try {
        await applyZoomLevel(z, stream);
      } catch {
        /* ignore */
      }
    } else {
      currentZoomValue.current = 1;
      setZoomDisplay("1x");
    }
  };

  /** Chọn lens/zoom pill — ultra/main/tele + digital zoom */
  const handleSelectLens = async (label) => {
    if (label === zoomLevel && label !== "0.5x") {
      // Bấm lại 0.5 vẫn ok; các mức khác bỏ qua
      return;
    }

    const isBack = cameraMode === "environment";
    const cameras = await getAvailableCameras();
    const mainId = isBack
      ? cameras?.backNormalCamera?.deviceId || (await getMainBackCameraId())
      : cameras?.frontCameras?.[0]?.deviceId || null;
    const ultraId = cameras?.backUltraWideCamera?.deviceId || null;
    const teleId = cameras?.backZoomCamera?.deviceId || null;
    const capabilities = getTrackCapabilities(getActiveTrack());
    const hasTrackZoom = Boolean(capabilities?.zoom);

    // 0.5x → ultra vật lý ưu tiên
    if (label === "0.5x") {
      if (isBack && ultraId) {
        setZoomLevel("0.5x");
        setZoomDisplay("0.5x");
        setDeviceId(ultraId);
        return;
      }
      if (hasTrackZoom && (capabilities?.zoom?.min ?? 1) < 1) {
        setZoomLevel("0.5x");
        try {
          await applyZoomLevel("0.5x");
          setZoomDisplay("0.5x");
        } catch {
          SonnerInfo(t("home.camera_no_zoom"));
        }
        return;
      }
      SonnerInfo(t("home.camera_no_zoom"));
      return;
    }

    // 1x → main
    if (label === "1x") {
      if (isBack && mainId && deviceId !== mainId) {
        setZoomLevel("1x");
        setZoomDisplay("1x");
        setDeviceId(mainId);
        return;
      }
      setZoomLevel("1x");
      try {
        if (hasTrackZoom) await applyZoomLevel("1x");
        setZoomDisplay("1x");
      } catch {
        /* ignore */
      }
      return;
    }

    // 3x / 5x → tele nếu có, không thì main + digital
    if ((label === "3x" || label === "5x") && isBack && teleId) {
      setZoomLevel(label);
      setZoomDisplay(label);
      setDeviceId(teleId);
      return;
    }

    // Đang ở ultra → chuyển main trước khi digital zoom
    if (isBack && mainId && ultraId && deviceId === ultraId) {
      setZoomLevel(label);
      setZoomDisplay(label);
      setDeviceId(mainId);
      // zoom digital apply sau khi stream mới mở (startCamera + sync)
      return;
    }

    if (hasTrackZoom) {
      setZoomLevel(label);
      try {
        await applyZoomLevel(label);
        setZoomDisplay(label);
      } catch {
        SonnerInfo(t("home.camera_no_zoom"));
      }
      return;
    }

    SonnerInfo(t("home.camera_no_zoom"));
  };

  const getTouchDistance = (touches) => {
    if (touches.length < 2) {
      return 0;
    }

    const [firstTouch, secondTouch] = touches;
    return Math.hypot(
      secondTouch.clientX - firstTouch.clientX,
      secondTouch.clientY - firstTouch.clientY
    );
  };

  const resetPinchState = () => {
    pinchState.current = { active: false, distance: 0, zoom: currentZoomValue.current };
  };

  const handlePreviewTouchStart = (event) => {
    if (event.touches.length !== 2) {
      return;
    }

    const capabilities = getTrackCapabilities(getActiveTrack());
    if (!capabilities.zoom) {
      return;
    }

    event.preventDefault();
    pinchState.current = {
      active: true,
      distance: getTouchDistance(event.touches),
      zoom: currentZoomValue.current,
    };
  };

  const handlePreviewTouchMove = async (event) => {
    if (!pinchState.current.active || event.touches.length !== 2) {
      return;
    }

    const capabilities = getTrackCapabilities(getActiveTrack());
    if (!capabilities.zoom) {
      return;
    }

    const now = Date.now();
    if (now - lastPinchUpdate.current < 40) {
      return;
    }

    const nextDistance = getTouchDistance(event.touches);
    if (!nextDistance || !pinchState.current.distance) {
      return;
    }

    event.preventDefault();
    lastPinchUpdate.current = now;

    const scale = nextDistance / pinchState.current.distance;
    const targetZoom = pinchState.current.zoom * scale;

    try {
      await applyZoomValue(targetZoom);
    } catch (error) {
      console.error("Không thể pinch để zoom:", error);
    }
  };

  const handlePreviewTouchEnd = () => {
    resetPinchState();
  };

  const stopCamera = ({ keepDisplay = false } = {}) => {
    startRequestId.current += 1;
    startingRef.current = false;
    resetPinchState();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current && !keepDisplay) {
      videoRef.current.srcObject = null;
    }
    cameraInitialized.current = false;
    setTorchSupported(false);
    setTorchEnabled(false);
    setZoomOptions(["1x"]);
    currentZoomValue.current = 1;
    setZoomDisplay("1x");
  };

  /**
   * Mở stream nhanh: ideal deviceId trước (ít fail hơn exact), fallback facingMode.
   * KHÔNG gọi setDeviceId trong đây — tránh useEffect restart → lag.
   */
  const openStreamWithDevice = async (targetDeviceId, mode) => {
    const quality = getCameraPreviewConstraints(
      CONFIG.app.camera.constraints.default,
    );

    const tryOpen = async (video) => {
      return navigator.mediaDevices.getUserMedia({
        video,
        audio: false,
      });
    };

    if (targetDeviceId) {
      try {
        return await tryOpen({
          deviceId: { ideal: targetDeviceId },
          ...quality,
        });
      } catch {
        try {
          return await tryOpen({
            deviceId: { exact: targetDeviceId },
            ...quality,
          });
        } catch {
          /* fall through */
        }
      }
    }

    return tryOpen({
      facingMode: { ideal: mode || "user" },
      ...quality,
    });
  };

  /**
   * Seamless start: mở stream mới → gắn video → tắt stream cũ.
   * Không setState deviceId giữa chừng (tránh double getUserMedia).
   */
  const startCamera = async () => {
    const requestId = startRequestId.current + 1;
    startRequestId.current = requestId;
    startingRef.current = true;

    try {
      if (
        cameraInitialized.current &&
        streamRef.current &&
        lastCameraMode.current === cameraMode &&
        lastDeviceId.current === deviceId &&
        lastZoomLevel.current === zoomLevel
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

      const mode = cameraMode || "user";
      const isBack = mode === "environment";
      const z = zoomLevel || "1x";
      let resolvedDeviceId = deviceId || null;

      // Cache enumerate — không block nếu đã có deviceId hợp lệ
      const cameras = await getAvailableCameras();
      const mainId =
        cameras?.backNormalCamera?.deviceId ||
        cameras?.backCameras?.find((c) => !isDeviceUltraWideSync(c))?.deviceId ||
        cameras?.backCameras?.[0]?.deviceId ||
        null;
      const ultraId = cameras?.backUltraWideCamera?.deviceId || null;
      const teleId = cameras?.backZoomCamera?.deviceId || null;
      const frontId = cameras?.frontCameras?.[0]?.deviceId || null;

      if (isBack && z === "1x") {
        resolvedDeviceId = mainId || deviceId;
      } else if (isBack && z === "0.5x") {
        resolvedDeviceId = ultraId || mainId || deviceId;
      } else if (isBack && (z === "2x" || z === "3x")) {
        resolvedDeviceId = teleId || mainId || deviceId;
      } else if (!isBack) {
        resolvedDeviceId = frontId || deviceId;
      } else {
        resolvedDeviceId = deviceId || mainId;
      }

      const oldStream = streamRef.current;
      let stream = await openStreamWithDevice(resolvedDeviceId, mode);

      if (requestId !== startRequestId.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      // Chỉ re-open nếu dính ultra khi cần 1x (1 lần)
      if (isBack && z === "1x" && mainId) {
        const actualId = stream.getVideoTracks?.()?.[0]?.getSettings?.()?.deviceId;
        if (actualId && ultraId && actualId === ultraId && actualId !== mainId) {
          stream.getTracks().forEach((t) => t.stop());
          stream = await openStreamWithDevice(mainId, mode);
          resolvedDeviceId = mainId;
        }
      }

      if (requestId !== startRequestId.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      cameraInitialized.current = true;
      lastCameraMode.current = cameraMode;
      lastDeviceId.current = resolvedDeviceId || deviceId;
      lastZoomLevel.current = zoomLevel;

      const actualId = getActiveTrack(stream)?.getSettings?.()?.deviceId;
      // Chỉ ref — KHÔNG setDeviceId (setState → useEffect restart → lag)
      if (actualId) lastDeviceId.current = actualId;
      else if (resolvedDeviceId) lastDeviceId.current = resolvedDeviceId;

      if (videoRef.current) {
        const v = videoRef.current;
        v.srcObject = stream;
        v.muted = true;
        v.playsInline = true;
        v.setAttribute("playsinline", "true");
        v.setAttribute("webkit-playsinline", "true");
        // Ưu tiên decode mượt
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

      if (oldStream && oldStream !== stream) {
        try {
          oldStream.getTracks().forEach((t) => t.stop());
        } catch {
          /* ignore */
        }
      }

      // Features sau khi frame đã hiện
      try {
        await syncTrackFeatures(stream);
      } catch (error) {
        console.error("Không thể đồng bộ tính năng camera:", error);
      }

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
    }
  };

  // helper sync (label only) — tránh async isDeviceUltraWide trong hot path
  function isDeviceUltraWideSync(device) {
    if (!device) return false;
    return /ultra|0\.5|cực\s*rộng|siêu\s*rộng|wide\s*angle/i.test(
      device.label || "",
    );
  }

  // Tab ẩn / hiện
  useEffect(() => {
    const onVis = () => {
      setPageVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Preload pills (0.5x…) theo lens máy ngay khi vào cam sau
  useEffect(() => {
    if (!cameraActive || preview || selectedFile) return;
    refreshLensPills(streamRef.current).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive, cameraMode]);

  // Lifecycle: chỉ chạy cam trên trang chụp
  // Lưu ý: deviceId đổi từ *trong* startCamera không được trigger lại (đã chặn setState)
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

  // Unmount
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

  const handleToggleTorch = async () => {
    if (!torchSupported) {
      SonnerInfo(t("home.flash_not_supported"));
      return;
    }

    const nextTorchState = !torchEnabled;

    try {
      const applied = await applyTorchState(nextTorchState);

      if (!applied) {
        SonnerInfo(t("home.flash_enable_failed"));
        return;
      }

      setTorchEnabled(nextTorchState);
    } catch (error) {
      SonnerInfo(t("home.flash_enable_failed"));
    }
  };

  const handleCycleZoomCamera = async () => {
    const isBackCamera = cameraMode === "environment";
    const isFrontCamera = cameraMode === "user";
    const cameras = await getAvailableCameras();
    const mainId =
      cameras?.backNormalCamera?.deviceId || (await getMainBackCameraId());
    const ultraId = cameras?.backUltraWideCamera?.deviceId;
    const teleId = cameras?.backZoomCamera?.deviceId;
    const track = getActiveTrack();
    const capabilities = getTrackCapabilities(track);
    const hasTrackZoom = Boolean(capabilities?.zoom);

    // Cycle: 1x (main) → 0.5x (ultra) → 2x/3x (tele/zoom) → 1x
    let newZoom = "1x";
    let newDeviceId = null;
    let useTrackOnly = false;

    if (isFrontCamera) {
      newZoom = zoomLevel === "1x" ? "0.5x" : "1x";
      newDeviceId = cameras?.frontCameras?.[0]?.deviceId;
      if (newZoom === "0.5x" && hasTrackZoom && !ultraId) {
        useTrackOnly = true;
      }
    } else if (isBackCamera) {
      if (zoomLevel === "1x" || !zoomLevel) {
        // 1x → 0.5x ưu tiên ultra physical
        if (ultraId) {
          newZoom = "0.5x";
          newDeviceId = ultraId;
        } else if (hasTrackZoom) {
          newZoom = "0.5x";
          newDeviceId = mainId || deviceId;
          useTrackOnly = true;
        } else if (teleId) {
          newZoom = "3x";
          newDeviceId = teleId;
        } else {
          SonnerInfo(t("home.camera_no_zoom"));
          return;
        }
      } else if (zoomLevel === "0.5x") {
        // 0.5 → tele hoặc 2x track, không thì về 1x
        if (teleId) {
          newZoom = "3x";
          newDeviceId = teleId;
        } else if (hasTrackZoom && (capabilities?.zoom?.max || 1) >= 2) {
          newZoom = "2x";
          newDeviceId = mainId || deviceId;
          useTrackOnly = true;
        } else {
          newZoom = "1x";
          newDeviceId = mainId;
        }
      } else {
        // 2x/3x → 1x main
        newZoom = "1x";
        newDeviceId = mainId;
      }
    }

    if (newZoom === "1x" && isBackCamera) {
      newDeviceId = mainId || newDeviceId;
    }

    // Cùng device, chỉ đổi track zoom (0.5/2 trên main)
    if (
      useTrackOnly ||
      (newDeviceId &&
        newDeviceId === deviceId &&
        hasTrackZoom &&
        newZoom !== "1x")
    ) {
      try {
        const applied = await applyZoomLevel(newZoom);
        if (applied) {
          setZoomLevel(newZoom);
          setZoomDisplay(newZoom);
          return;
        }
      } catch (e) {
        console.error("track zoom:", e);
      }
    }

    if (newDeviceId) {
      // Seamless: chỉ đổi state — startCamera mở stream mới rồi tắt cũ
      setZoomLevel(newZoom);
      setDeviceId(newDeviceId);
    } else if (hasTrackZoom) {
      try {
        await applyZoomLevel(newZoom);
        setZoomLevel(newZoom);
        setZoomDisplay(newZoom);
      } catch {
        SonnerInfo(t("home.camera_no_zoom"));
      }
    } else {
      SonnerInfo(t("home.camera_no_zoom"));
    }
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
              // GPU layer — mirror front; tránh willChange:contents (tốn RAM/lag Android)
              transform:
                cameraMode === "user"
                  ? "translate3d(0,0,0) scaleX(-1)"
                  : "translate3d(0,0,0)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          />
        )}

        {!preview && !selectedFile && (
          <>
            {/* Chỉ flash — KHÔNG pills zoom / nút 1x (bất kỳ trường hợp nào) */}
            <div className="absolute inset-0 top-7 px-7 z-30 pointer-events-none flex justify-start text-base-content text-xs font-semibold">
              <button
                onClick={handleToggleTorch}
                className="pointer-events-auto w-7 h-7 p-1.5 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center"
              >
                <img src="/icons/bolt.fill.png" alt="Icon sấm sét" />
              </button>
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
            style={{
              imageRendering: "auto",
              WebkitUserDrag: "none",
            }}
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

export default MediaPreviewAndroid;
