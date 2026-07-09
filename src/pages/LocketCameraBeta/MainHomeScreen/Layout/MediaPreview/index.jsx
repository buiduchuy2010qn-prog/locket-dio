import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import MediaSizeInfo from "@/components/ui/MediaSizeInfo";
import { showInfo } from "@/components/Toast";
import { getAvailableCameras } from "@/utils";
const AutoResizeCaption = lazy(() => import("../CaptionViews"));
import { useApp } from "@/context/AppContext";
import BorderProgress from "../../Widgets/SquareProgress";
import {
  openCameraStream,
  stopMediaStream,
} from "@/utils/device/cameraStream";
import {
  applyTrackZoom,
  buildZoomSteps,
  formatZoomLabel,
  getTrackZoomCapability,
  getZoomRange,
  hasTorchSupport,
  setTorch,
  touchDistance,
} from "@/utils/device/cameraZoom";

const MediaPreview = ({ capturedMedia }) => {
  const { post, camera } = useApp();
  const { selectedFile, preview } = post;
  const {
    streamRef,
    videoRef,
    cameraActive,
    setCameraActive,
    cameraMode,
    setCameraMode,
    zoomLevel,
    setZoomLevel,
    zoomFactor,
    setZoomFactor,
    zoomSteps,
    setZoomSteps,
    deviceId,
    setDeviceId,
    selectedFrame,
  } = camera;

  const startingRef = useRef(false);
  const startGenRef = useRef(0);
  const mountedRef = useRef(true);
  const camerasCacheRef = useRef(null);
  const openedModeRef = useRef(cameraMode || "user");
  const clearedModeRef = useRef(cameraMode || "user");
  const zoomFactorRef = useRef(zoomFactor || 1);
  const pinchRef = useRef(null); // { startDist, startZoom }
  const [digitalScale, setDigitalScale] = useState(1);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  useEffect(() => {
    zoomFactorRef.current = zoomFactor;
  }, [zoomFactor]);

  const stopCamera = useCallback(() => {
    // tắt flash trước khi stop
    if (streamRef.current) {
      setTorch(streamRef.current, false).catch(() => {});
    }
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    startingRef.current = false;
    setTorchOn(false);
    setTorchAvailable(false);
  }, [streamRef, videoRef]);

  const refreshZoomSteps = useCallback(
    async (stream) => {
      try {
        if (!camerasCacheRef.current) {
          camerasCacheRef.current = await getAvailableCameras();
        }
        const cap = getTrackZoomCapability(stream);
        const steps = buildZoomSteps({
          facingMode: cameraMode || "user",
          cameras: camerasCacheRef.current,
          trackCap: cap,
        });
        setZoomSteps(steps);
      } catch (e) {
        console.warn("zoom steps", e);
      }
    },
    [cameraMode, setZoomSteps]
  );

  /** Zoom liên tục (pinch) — optical nếu có, không thì digital scale */
  const applyContinuousZoom = useCallback(
    async (rawFactor, { fromPinch = false } = {}) => {
      const stream = streamRef.current;
      const range = getZoomRange(stream, cameraMode || "user");
      let factor = Math.min(range.max, Math.max(range.min, Number(rawFactor) || 1));

      // làm tròn nhẹ khi gần 1x
      if (Math.abs(factor - 1) < 0.03) factor = 1;

      setZoomFactor(factor);
      setZoomLevel(formatZoomLabel(factor));
      zoomFactorRef.current = factor;

      if (!stream) {
        setDigitalScale(Math.max(1, factor));
        return;
      }

      // Zoom-out dưới 1: thử native; không được thì giữ 1 (không fake crop)
      if (factor < 0.98) {
        const ok = await applyTrackZoom(stream, factor);
        if (ok) {
          setDigitalScale(1);
        } else {
          // không hỗ trợ UW → kẹp về 1
          factor = 1;
          setZoomFactor(1);
          setZoomLevel("1x");
          zoomFactorRef.current = 1;
          setDigitalScale(1);
          await applyTrackZoom(stream, 1);
        }
        return;
      }

      // Zoom-in: optical trước, digital bù
      if (factor > 1.01) {
        const opticalMax = range.opticalMax || 1;
        const opticalTarget = Math.min(factor, Math.max(1, opticalMax));
        const ok = await applyTrackZoom(stream, opticalTarget);
        if (ok && factor <= opticalMax + 0.05) {
          setDigitalScale(1);
        } else if (ok) {
          // optical max + digital phần dư
          setDigitalScale(factor / Math.max(opticalMax, 1));
        } else {
          await applyTrackZoom(stream, 1);
          setDigitalScale(factor);
        }
        return;
      }

      await applyTrackZoom(stream, 1);
      setDigitalScale(1);
    },
    [cameraMode, setZoomFactor, setZoomLevel, streamRef]
  );

  const startCamera = useCallback(async () => {
    if (!cameraActive || preview || selectedFile) return;

    const gen = ++startGenRef.current;
    startingRef.current = true;
    const mode = cameraMode || "user";
    const switchingFacing = openedModeRef.current !== mode;

    try {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setTorchOn(false);

      await new Promise((r) => setTimeout(r, switchingFacing ? 280 : 100));
      if (gen !== startGenRef.current || !mountedRef.current) return;

      const stream = await openCameraStream({
        facingMode: mode,
        deviceId: switchingFacing ? null : deviceId || null,
      });

      if (gen !== startGenRef.current || !mountedRef.current) {
        stopMediaStream(stream);
        return;
      }

      streamRef.current = stream;
      openedModeRef.current = mode;

      const zf = zoomFactorRef.current || 1;
      if (zf > 1.01 || zf < 0.98) {
        await applyContinuousZoom(zf);
      } else {
        setDigitalScale(1);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.muted = true;
        const p = videoRef.current.play?.();
        if (p?.catch) p.catch(() => {});
      }

      setTorchAvailable(mode === "environment" && hasTorchSupport(stream));
      await refreshZoomSteps(stream);
    } catch (err) {
      console.error("startCamera failed:", err?.name, err?.message || err);
      if (gen !== startGenRef.current) return;

      if (mode === "environment") {
        showInfo(
          "Không mở được camera sau. Dùng Chrome, cấp quyền Camera, thử lại."
        );
        setDeviceId(null);
        if (typeof setCameraMode === "function") {
          setCameraMode("user");
        }
        return;
      }
      showInfo("Không mở được camera. Kiểm tra quyền trình duyệt.");
    } finally {
      if (gen === startGenRef.current) {
        startingRef.current = false;
      }
    }
  }, [
    cameraActive,
    cameraMode,
    deviceId,
    preview,
    selectedFile,
    setCameraMode,
    setDeviceId,
    streamRef,
    videoRef,
    refreshZoomSteps,
    applyContinuousZoom,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      startGenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const mode = cameraMode || "user";
    if (clearedModeRef.current === mode) return;
    clearedModeRef.current = mode;
    camerasCacheRef.current = null;
    setZoomLevel("1x");
    setZoomFactor(1);
    setDigitalScale(1);
    setTorchOn(false);
    setTorchAvailable(false);
    setDeviceId(null);
  }, [cameraMode, setDeviceId, setZoomFactor, setZoomLevel]);

  useEffect(() => {
    if (!cameraActive || preview || selectedFile) {
      stopCamera();
      return;
    }
    startCamera();
  }, [
    cameraActive,
    cameraMode,
    deviceId,
    preview,
    selectedFile,
    startCamera,
    stopCamera,
  ]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const showLive =
    !preview && !selectedFile && !capturedMedia && cameraActive;

  // ----- Flash / torch -----
  const handleToggleFlash = async () => {
    if (cameraMode !== "environment") {
      showInfo("Đèn flash chỉ dùng với camera sau");
      return;
    }
    const stream = streamRef.current;
    if (!stream) {
      showInfo("Camera chưa sẵn sàng");
      return;
    }
    if (!hasTorchSupport(stream)) {
      showInfo("Máy/trình duyệt không hỗ trợ đèn flash");
      setTorchAvailable(false);
      return;
    }
    const next = !torchOn;
    const ok = await setTorch(stream, next);
    if (!ok) {
      showInfo("Không bật được đèn flash");
      setTorchOn(false);
      return;
    }
    setTorchOn(next);
    setTorchAvailable(true);
  };

  // ----- Pinch to zoom (2 ngón) -----
  const onTouchStart = (e) => {
    if (!showLive) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      pinchRef.current = {
        startDist: touchDistance(e.touches[0], e.touches[1]),
        startZoom: zoomFactorRef.current || 1,
      };
    }
  };

  const onTouchMove = (e) => {
    if (!showLive) return;
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dist = touchDistance(e.touches[0], e.touches[1]);
      const { startDist, startZoom } = pinchRef.current;
      if (startDist < 8) return;
      const ratio = dist / startDist;
      // mượt: scale theo tỉ lệ khoảng cách
      const next = startZoom * ratio;
      // throttle nhẹ bằng rAF
      if (onTouchMove._raf) cancelAnimationFrame(onTouchMove._raf);
      onTouchMove._raf = requestAnimationFrame(() => {
        applyContinuousZoom(next, { fromPinch: true });
      });
    }
  };

  const onTouchEnd = (e) => {
    if (e.touches.length < 2) {
      pinchRef.current = null;
    }
  };

  // mirror + digital zoom transform
  const videoStyle = (() => {
    const parts = [];
    if (cameraMode === "user") parts.push("scaleX(-1)");
    if (digitalScale > 1.01) parts.push(`scale(${digitalScale})`);
    return parts.length
      ? { transform: parts.join(" "), transformOrigin: "center center" }
      : undefined;
  })();

  return (
    <>
      <div
        className="relative w-full max-w-md aspect-square bg-gray-800 rounded-[65px] overflow-hidden touch-none select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {showLive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover origin-center will-change-transform"
            style={videoStyle}
          />
        )}

        {!preview && !selectedFile && (
          <>
            <div className="absolute inset-0 top-7 px-5 z-30 pointer-events-none flex justify-between items-start text-base-content text-xs font-semibold">
              {/* Flash — camera sau */}
              <button
                type="button"
                onClick={handleToggleFlash}
                className={`pointer-events-auto w-9 h-9 p-1.5 rounded-full backdrop-blur-md flex items-center justify-center transition ${
                  torchOn
                    ? "bg-yellow-400/90 shadow-lg shadow-yellow-400/40"
                    : cameraMode === "environment"
                      ? "bg-white/30"
                      : "bg-white/15 opacity-50"
                }`}
                title={
                  cameraMode === "environment"
                    ? torchOn
                      ? "Tắt đèn flash"
                      : "Bật đèn flash"
                    : "Flash chỉ dùng camera sau"
                }
              >
                <img
                  src="/icons/bolt.fill.png"
                  alt="Flash"
                  className={`w-full h-full object-contain ${
                    torchOn ? "brightness-0" : ""
                  }`}
                />
              </button>

              {/* Chỉ hiện mức zoom hiện tại (không còn thanh 1 / 1.5 / 2 / 3) */}
              <div
                className="pointer-events-none min-w-9 h-8 px-2.5 text-primary-content font-bold rounded-full bg-white/35 backdrop-blur-md flex items-center justify-center shadow text-xs"
                title="Chạm 2 ngón và kéo để zoom"
              >
                {zoomLevel}
              </div>
            </div>

            {selectedFrame?.imageSrc && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                <img
                  src={selectedFrame.imageSrc}
                  alt="Khung viền camera"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
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
            className="w-full h-full object-cover"
          />
        )}

        {preview?.type === "image" && (
          <img
            src={preview.data}
            alt="Preview"
            className="w-full h-full object-cover select-none"
            decoding="async"
          />
        )}

        <div
          className={`absolute z-10 inset-x-0 bottom-0 px-4 pb-4 transform transition-opacity duration-200 ${
            preview && selectedFile
              ? "opacity-100"
              : "opacity-0 pointer-events-none"
          }`}
        >
          <Suspense fallback={null}>
            <AutoResizeCaption />
          </Suspense>
        </div>

        <div className="absolute inset-0 z-50 pointer-events-none">
          <BorderProgress />
        </div>
      </div>

      <div className="text-sm flex items-center justify-center pl-3">
        <MediaSizeInfo />
      </div>
    </>
  );
};

export default MediaPreview;
