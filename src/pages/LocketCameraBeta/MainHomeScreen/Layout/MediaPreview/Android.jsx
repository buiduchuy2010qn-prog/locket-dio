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
  const { useloading, camera } = useApp();
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

  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);
  const videoCropData = usePostStore((s) => s.videoCropData);

  const cameraInitialized = useRef(false);
  const lastCameraMode = useRef(cameraMode);
  const lastDeviceId = useRef(deviceId);
  const startRequestId = useRef(0);
  const pinchState = useRef({ active: false, distance: 0, zoom: 1 });
  const currentZoomValue = useRef(1);
  const lastPinchUpdate = useRef(0);

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

  const getZoomLabels = (capabilities) => {
    const minZoom = capabilities?.zoom?.min || 1;
    const maxZoom = capabilities?.zoom?.max || 1;
    const labels = [];

    if (minZoom < 1) {
      labels.push("0.5x");
    }

    labels.push("1x");

    if (maxZoom >= 2) {
      labels.push("2x");
    }

    if (maxZoom >= 3) {
      labels.push("3x");
    }

    return [...new Set(labels)];
  };

  const getZoomValue = (label, capabilities) => {
    const minZoom = capabilities?.zoom?.min || 1;
    const maxZoom = capabilities?.zoom?.max || 1;

    if (label === "0.5x") {
      return Math.max(minZoom, Math.min(0.5, maxZoom));
    }

    if (label === "2x") {
      return Math.max(minZoom, Math.min(2, maxZoom));
    }

    if (label === "3x") {
      return Math.max(minZoom, Math.min(3, maxZoom));
    }

    return Math.max(minZoom, Math.min(1, maxZoom));
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

  /** Build danh sách pill 0.5 / 1 / 2 từ hardware + continuous zoom */
  const refreshLensPills = async (stream) => {
    const track = getActiveTrack(stream);
    const capabilities = getTrackCapabilities(track);
    const fromTrack = getZoomLabels(capabilities);
    const pills = new Set(["1x"]);

    if (fromTrack.includes("0.5x") || (capabilities?.zoom?.min ?? 1) < 1) {
      pills.add("0.5x");
    }
    if (fromTrack.includes("2x") || (capabilities?.zoom?.max ?? 1) >= 2) {
      pills.add("2x");
    }
    if (fromTrack.includes("3x") || (capabilities?.zoom?.max ?? 1) >= 3) {
      pills.add("3x");
    }

    try {
      const cameras = await getAvailableCameras();
      if (cameras?.backUltraWideCamera) pills.add("0.5x");
      if (cameras?.backZoomCamera) pills.add("3x");
    } catch {
      /* optional */
    }

    // Thứ tự hiển thị: 0.5 → 1 → 2 → 3
    const order = ["0.5x", "1x", "2x", "3x"];
    const list = order.filter((z) => pills.has(z));
    setLensPills(list.length ? list : ["1x"]);
    setZoomOptions(fromTrack.length ? fromTrack : ["1x"]);
  };

  const syncTrackFeatures = async (stream) => {
    const track = getActiveTrack(stream);
    const capabilities = getTrackCapabilities(track);
    const supportedZoomOptions = getZoomLabels(capabilities);

    setTorchSupported(Boolean(capabilities.torch));
    setZoomDisplay(formatZoomDisplay(currentZoomValue.current));
    await refreshLensPills(stream);

    if (!capabilities.torch) {
      setTorchEnabled(false);
    }

    if (!capabilities.zoom) {
      currentZoomValue.current = 1;
      setZoomDisplay(zoomLevel === "0.5x" ? "0.5x" : "1x");
      return;
    }

    // Giữ zoom user chọn; mặc định 1x
    let nextZoomLevel = zoomLevel || "1x";
    if (
      nextZoomLevel !== "0.5x" &&
      !supportedZoomOptions.includes(nextZoomLevel)
    ) {
      nextZoomLevel = supportedZoomOptions.includes("1x")
        ? "1x"
        : supportedZoomOptions[0] || "1x";
    }

    if (nextZoomLevel !== zoomLevel && nextZoomLevel !== "0.5x") {
      // 0.5 physical không cần applyConstraints zoom
      setZoomLevel(nextZoomLevel);
    }

    if (nextZoomLevel !== "0.5x" || supportedZoomOptions.includes("0.5x")) {
      await applyZoomLevel(
        nextZoomLevel === "0.5x" && !supportedZoomOptions.includes("0.5x")
          ? "1x"
          : nextZoomLevel,
        stream,
      );
    }
  };

  /** Chọn lens/zoom cụ thể (pill 0.5 / 1 / 2) */
  const handleSelectLens = async (label) => {
    if (label === zoomLevel && label !== "0.5x") return;

    const isBack = cameraMode === "environment";
    const cameras = isBack ? await getAvailableCameras() : null;
    const mainId = isBack ? await getMainBackCameraId() : null;
    const capabilities = getTrackCapabilities(getActiveTrack());
    const hasTrackZoom = Boolean(capabilities?.zoom);

    if (label === "1x") {
      // Bắt buộc main + zoom 1
      if (isBack && mainId && deviceId !== mainId) {
        setZoomLevel("1x");
        setDeviceId(mainId);
        setCameraActive(false);
        setTimeout(() => setCameraActive(true), 250);
        return;
      }
      setZoomLevel("1x");
      try {
        await applyZoomLevel("1x");
        setZoomDisplay("1x");
      } catch {
        /* ignore */
      }
      return;
    }

    if (label === "0.5x") {
      // Ưu tiên ultra physical; không thì zoom min trên main
      if (isBack && cameras?.backUltraWideCamera?.deviceId) {
        setZoomLevel("0.5x");
        setDeviceId(cameras.backUltraWideCamera.deviceId);
        setCameraActive(false);
        setTimeout(() => setCameraActive(true), 250);
        return;
      }
      if (hasTrackZoom) {
        setZoomLevel("0.5x");
        try {
          await applyZoomLevel("0.5x");
        } catch {
          SonnerInfo(t("home.camera_no_zoom"));
        }
        return;
      }
      SonnerInfo(t("home.camera_no_zoom"));
      return;
    }

    // 2x / 3x
    if (isBack && cameras?.backZoomCamera?.deviceId && label === "3x") {
      setZoomLevel("3x");
      setDeviceId(cameras.backZoomCamera.deviceId);
      setCameraActive(false);
      setTimeout(() => setCameraActive(true), 250);
      return;
    }

    // Zoom digital trên main
    if (isBack && mainId && (await isDeviceUltraWide(deviceId))) {
      setZoomLevel(label);
      setDeviceId(mainId);
      setCameraActive(false);
      setTimeout(() => setCameraActive(true), 250);
      return;
    }

    if (hasTrackZoom) {
      setZoomLevel(label);
      try {
        await applyZoomLevel(label);
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

  const stopCamera = () => {
    startRequestId.current += 1;
    resetPinchState();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
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
   * Mở stream với deviceId (exact → ideal → facingMode).
   * Ở 1x + camera sau: bắt buộc main, từ chối ultra-wide.
   */
  const openStreamWithDevice = async (targetDeviceId, mode, forceMain) => {
    const quality = getCameraPreviewConstraints(
      CONFIG.app.camera.constraints.default,
    );

    const tryOpen = async (video) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio: false,
      });
      return stream;
    };

    // 1) exact deviceId (ép lens đúng)
    if (targetDeviceId) {
      try {
        return await tryOpen({
          deviceId: { exact: targetDeviceId },
          ...quality,
        });
      } catch {
        /* try ideal */
      }
      try {
        return await tryOpen({
          deviceId: { ideal: targetDeviceId },
          ...quality,
        });
      } catch {
        /* fall through */
      }
    }

    // 2) facingMode — chỉ khi không force main hoặc không có id
    if (!forceMain) {
      return tryOpen({
        facingMode: { ideal: mode || "user" },
        ...quality,
      });
    }

    // force main nhưng exact fail: thử lại main id 1 lần nữa bằng ideal
    if (targetDeviceId) {
      return tryOpen({
        deviceId: { ideal: targetDeviceId },
        facingMode: { ideal: "environment" },
        ...quality,
      });
    }

    return tryOpen({
      facingMode: { ideal: mode || "user" },
      ...quality,
    });
  };

  const startCamera = async () => {
    const requestId = startRequestId.current + 1;
    startRequestId.current = requestId;

    try {
      if (
        cameraInitialized.current &&
        streamRef.current &&
        lastCameraMode.current === cameraMode &&
        lastDeviceId.current === deviceId
      ) {
        if (videoRef.current && !videoRef.current.srcObject) {
          videoRef.current.srcObject = streamRef.current;
        }
        return;
      }

      if (
        streamRef.current &&
        (lastCameraMode.current !== cameraMode ||
          lastDeviceId.current !== deviceId)
      ) {
        stopCamera();
      }

      const mode = cameraMode || "user";
      const isBack = mode === "environment";
      const z = zoomLevel || "1x";
      // 1x = BẮT BUỘC camera chính. 0.5x = ultra (nếu có). 2x/3x = tele hoặc main+zoom.
      let resolvedDeviceId = null;

      if (isBack && z === "1x") {
        resolvedDeviceId = await getMainBackCameraId();
      } else if (isBack && z === "0.5x") {
        resolvedDeviceId = await pickCameraDeviceId(mode, "0.5x");
      } else if (isBack && (z === "2x" || z === "3x")) {
        // Giữ device hiện tại nếu đã là tele/main; không bao giờ ultra
        if (deviceId && !(await isDeviceUltraWide(deviceId))) {
          resolvedDeviceId = deviceId;
        } else {
          resolvedDeviceId = await pickCameraDeviceId(mode, z);
        }
      } else {
        resolvedDeviceId =
          deviceId || (await pickCameraDeviceId(mode, z === "0.5x" ? "0.5x" : "1x"));
      }

      // An toàn: nếu vẫn null / ultra khi cần 1x → main
      if (isBack && z === "1x") {
        const mainId = await getMainBackCameraId();
        if (mainId) resolvedDeviceId = mainId;
      }

      if (resolvedDeviceId && resolvedDeviceId !== deviceId) {
        setDeviceId(resolvedDeviceId);
      }

      let stream = await openStreamWithDevice(
        resolvedDeviceId,
        mode,
        isBack && z === "1x",
      );

      if (requestId !== startRequestId.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      // Nếu browser vẫn trả ultra khi đang 1x → mở lại bằng main exact
      if (isBack && zoomLevel === "1x") {
        const actualId = stream.getVideoTracks?.()?.[0]?.getSettings?.()?.deviceId;
        const mainId = await getMainBackCameraId();
        if (
          mainId &&
          actualId &&
          actualId !== mainId &&
          (await isDeviceUltraWide(actualId))
        ) {
          stream.getTracks().forEach((t) => t.stop());
          stream = await openStreamWithDevice(mainId, mode, true);
          resolvedDeviceId = mainId;
          setDeviceId(mainId);
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

      const actualId = getActiveTrack(stream)?.getSettings?.()?.deviceId;
      // Chỉ cập nhật deviceId nếu không phải “trôi” sang ultra khi đang 1x
      if (actualId) {
        const driftedUltra =
          isBack &&
          zoomLevel === "1x" &&
          (await isDeviceUltraWide(actualId));
        if (!driftedUltra) {
          if (actualId !== deviceId) setDeviceId(actualId);
          lastDeviceId.current = actualId;
        } else if (resolvedDeviceId) {
          lastDeviceId.current = resolvedDeviceId;
        }
      }

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

      try {
        await syncTrackFeatures(stream);
        // Sau khi mở: ép optical/digital zoom = 1 trên track (cam chính)
        if (zoomLevel === "0.5x" && isBack) {
          await applyZoomLevel("0.5x", stream);
        } else if (zoomLevel === "2x" || zoomLevel === "3x") {
          await applyZoomLevel(zoomLevel, stream);
        } else {
          await applyZoomLevel("1x", stream);
          currentZoomValue.current = 1;
          setZoomDisplay("1x");
          if (zoomLevel !== "1x") setZoomLevel("1x");
        }
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
      setCameraActive(false);
      cameraInitialized.current = false;
    }
  };

  useEffect(() => {
    if (cameraActive && !preview && !selectedFile) {
      startCamera();
    } else if (!cameraActive || preview || selectedFile) {
      // Chỉ tắt khi chụp xong / tắt camera — không stop trong cleanup mỗi lần re-render
      if (streamRef.current) {
        stopCamera();
      }
    }
  }, [cameraActive, cameraMode, deviceId, preview, selectedFile]);

  // Unmount: giải phóng camera (không stop giữa chừng khi chỉ đổi deps đã xử lý ở trên)
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
      setZoomLevel(newZoom);
      setDeviceId(newDeviceId);
      setCameraActive(false);
      setTimeout(() => setCameraActive(true), 300);
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
              // GPU layer — giảm jank; mirror front camera
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
            <div className="absolute inset-0 top-7 px-7 z-30 pointer-events-none flex justify-between text-base-content text-xs font-semibold">
              <button
                onClick={handleToggleTorch}
                className="pointer-events-auto w-7 h-7 p-1.5 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center"
              >
                <img src="/icons/bolt.fill.png" alt="Icon sấm sét" />
              </button>

              {/* Cycle zoom: 0.5x → 1x → 2x/3x (không pill dưới camera) */}
              <button
                onClick={handleCycleZoomCamera}
                className="pointer-events-auto min-w-8 h-8 px-2 text-primary-content font-semibold rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-xs"
              >
                {zoomDisplay}
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
            decoding="async"
            className={`w-full h-full object-cover object-center select-none transition-opacity duration-300 bg-black ${
              preview ? "opacity-100" : "opacity-0"
            }`}
            style={{
              // Tránh méo / vỡ pixel khi scale
              imageRendering: "auto",
              WebkitUserDrag: "none",
            }}
          />
        )}

        <div
          className={`absolute z-10 inset-x-0 bottom-0 px-4 pb-4 transform transition-all duration-300 
          ${
            preview && selectedFile
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
