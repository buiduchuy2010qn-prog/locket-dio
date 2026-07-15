import "./styles.css";
import React, { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { getVideoRecordLimit } from "@/hooks/useFeature";
import { CAMERA_CONFIG } from "@/config/configAlias";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { usePostStore } from "@/stores";
import { useTranslation } from "react-i18next";
import { getPerfProfile } from "@/utils/device/perfProfile";

/** Ngưỡng giữ để bắt đầu quay (ms) — thấp hơn = nhạy hơn */
const HOLD_TO_RECORD_MS = 380;

function pickMimeType() {
  // Prefer higher-quality codecs first when available
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const t of candidates) {
    try {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    } catch {
      /* ignore */
    }
  }
  return "";
}

/**
 * Encode / canvas targets — use full stream resolution when available.
 * size/captureSize = max side (square crop); never upscale above native.
 */
function recordProfile() {
  const p = getPerfProfile();
  const imgTarget = CAMERA_CONFIG.imageSizePx || 1920;
  const vidTarget = CAMERA_CONFIG.videoResolutionPx || 1080;

  // Low-end: still aim for 720p+/~90% JPEG — no more 640/0.86 blur
  if (p.isLowEnd) {
    return {
      size: Math.min(vidTarget, 720),
      maxSize: 1080,
      fps: 30,
      bitrate: 4_500_000,
      jpegQ: 0.92,
      captureSize: Math.min(imgTarget, 1440),
      maxCapture: 1920,
    };
  }
  // Mobile (Android + iOS): Full HD targets, 60 fps when stream allows
  if (p.isAndroid || p.isMobile || p.isIOS) {
    return {
      size: Math.min(vidTarget, 1080),
      maxSize: 1080,
      fps: 60,
      bitrate: 8_000_000,
      jpegQ: 0.94,
      captureSize: imgTarget,
      maxCapture: 2560,
    };
  }
  // Desktop
  return {
    size: Math.min(vidTarget, 1080),
    maxSize: 1440,
    fps: 60,
    bitrate: 12_000_000,
    jpegQ: 0.95,
    captureSize: imgTarget,
    maxCapture: 3840,
  };
}

/** Square export size from live video — prefer native, cap by profile */
function squareOutputSize(video, maxSide) {
  const vw = video?.videoWidth || 0;
  const vh = video?.videoHeight || 0;
  const native = Math.min(vw, vh);
  if (native > 0) return Math.min(native, maxSide);
  return maxSide;
}

const CameraButton = () => {
  const { t } = useTranslation("main");
  const { camera } = useApp();
  const {
    videoRef,
    canvasRef,
    isHolding,
    setIsHolding,
    holdTime,
    setHoldTime,
    cameraMode,
    setCameraActive,
    setLoading,
  } = camera;

  const setMediaFromFile = usePostStore((s) => s.setMediaFromFile);

  const holdStartTimeRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const intervalRef = useRef(null);
  const isTryingToRecordRef = useRef(false);
  const isRecordingRef = useRef(false);
  const drawRafRef = useRef(0);
  const capturingRef = useRef(false);

  const MAX_RECORD_TIME = getVideoRecordLimit();

  const startHold = (e) => {
    if (e.type === "mousedown" && e.button !== 0) return;
    e.preventDefault();
    if (capturingRef.current) return;

    isTryingToRecordRef.current = true;
    isRecordingRef.current = false;
    holdStartTimeRef.current = Date.now();

    holdTimeoutRef.current = setTimeout(() => {
      if (!isTryingToRecordRef.current) return;
      beginVideoRecord();
    }, HOLD_TO_RECORD_MS);
  };

  const beginVideoRecord = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      SonnerInfo(t("home.camera_not_ready"));
      isTryingToRecordRef.current = false;
      setIsHolding(false);
      return;
    }

    isRecordingRef.current = true;
    setIsHolding(true);

    const prof = recordProfile();
    // Use native square crop size (up to profile max) — avoid forced downscale to 720
    const side = Math.min(video.videoWidth || 720, video.videoHeight || 720);
    const outputSize = Math.min(side, prof.maxSize || prof.size || 1080);

    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) {
      isRecordingRef.current = false;
      setIsHolding(false);
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // fps: request 60; browser/captureStream may deliver lower if needed
    const canvasStream = canvas.captureStream(prof.fps);
    const mimeType = pickMimeType();
    const recorderOptions = mimeType ? { mimeType } : {};
    if (mimeType) {
      recorderOptions.videoBitsPerSecond = prof.bitrate;
    }

    let recorder;
    try {
      recorder = new MediaRecorder(canvasStream, recorderOptions);
    } catch {
      try {
        recorder = new MediaRecorder(canvasStream);
      } catch (err) {
        console.error("MediaRecorder fail", err);
        isRecordingRef.current = false;
        setIsHolding(false);
        SonnerInfo(t("home.camera_not_ready"));
        return;
      }
    }
    mediaRecorderRef.current = recorder;

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      if (drawRafRef.current) {
        cancelAnimationFrame(drawRafRef.current);
        drawRafRef.current = 0;
      }
      try {
        canvasStream.getTracks().forEach((tr) => tr.stop());
      } catch {
        /* ignore */
      }

      if (!chunks.length) {
        isRecordingRef.current = false;
        setIsHolding(false);
        return;
      }

      const finalMime = recorder.mimeType || mimeType || "video/webm";
      const ext = finalMime.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: finalMime });
      const file = new File([blob], `locket_dio.${ext}`, { type: finalMime });

      // Preview ngay
      setMediaFromFile(file);
      setCameraActive(false);
      setLoading?.(false);
      isRecordingRef.current = false;
      setIsHolding(false);
    };

    recorder.onerror = () => {
      isRecordingRef.current = false;
      setIsHolding(false);
      if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
    };

    try {
      // timeslice → data đều, stop mượt hơn
      recorder.start(250);
    } catch {
      try {
        recorder.start();
      } catch {
        isRecordingRef.current = false;
        setIsHolding(false);
        return;
      }
    }

    const frameInterval = 1000 / prof.fps;
    let lastFrame = 0;
    const isFront = cameraMode === "user";

    const drawFrame = (ts) => {
      if (recorder.state !== "recording") return;
      if (ts - lastFrame < frameInterval - 1) {
        drawRafRef.current = requestAnimationFrame(drawFrame);
        return;
      }
      lastFrame = ts;

      if (video.readyState >= 2) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (isFront) {
          ctx.translate(outputSize, 0);
          ctx.scale(-1, 1);
        }
        const sx = (video.videoWidth - side) / 2;
        const sy = (video.videoHeight - side) / 2;
        ctx.drawImage(
          video,
          sx,
          sy,
          side,
          side,
          0,
          0,
          outputSize,
          outputSize,
        );
      }
      drawRafRef.current = requestAnimationFrame(drawFrame);
    };
    drawRafRef.current = requestAnimationFrame(drawFrame);

    // Auto stop
    setTimeout(() => {
      if (recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {
          /* ignore */
        }
      }
    }, MAX_RECORD_TIME * 1000);
  };

  const endHold = (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (!isTryingToRecordRef.current && !isRecordingRef.current) {
      return;
    }

    const heldTime = Date.now() - (holdStartTimeRef.current || Date.now());
    clearTimeout(holdTimeoutRef.current);
    clearInterval(intervalRef.current);
    setHoldTime(heldTime);

    const wasTrying = isTryingToRecordRef.current;
    isTryingToRecordRef.current = false;
    holdStartTimeRef.current = null;

    if (
      isRecordingRef.current &&
      mediaRecorderRef.current?.state === "recording"
    ) {
      try {
        mediaRecorderRef.current.requestData?.();
      } catch {
        /* ignore */
      }
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
      return;
    }

    if (isHolding && !isRecordingRef.current) {
      setIsHolding(false);
      return;
    }

    const isLeave =
      e?.type === "mouseleave" ||
      e?.type === "pointerleave" ||
      e?.type === "touchcancel";
    if (isLeave) {
      setIsHolding(false);
      return;
    }

    if (wasTrying && !isRecordingRef.current) {
      captureImage();
    }
  };

  /**
   * Chụp — freeze + preview JPEG ngay, blob encode nền.
   */
  const captureImage = () => {
    if (capturingRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (!video.videoWidth || video.readyState < 2) {
      SonnerInfo(t("home.camera_not_ready"));
      return;
    }

    capturingRef.current = true;

    try {
      video.pause();
    } catch {
      /* ignore */
    }

    const paintAndShow = () => {
      const prof = recordProfile();
      // Prefer native sensor square size — no forced downscale to 1280/1440
      const outputSize = squareOutputSize(
        video,
        prof.maxCapture || prof.captureSize || 1920,
      );

      canvas.width = outputSize;
      canvas.height = outputSize;

      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });
      if (!ctx) {
        capturingRef.current = false;
        return;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Only smooth if we must scale; native 1:1 stays sharp
      const nativeSide = Math.min(video.videoWidth || 0, video.videoHeight || 0);
      const scaling = nativeSide > 0 && nativeSide !== outputSize;
      ctx.imageSmoothingEnabled = scaling;
      ctx.imageSmoothingQuality = scaling ? "high" : "low";

      let sx = 0;
      let sy = 0;
      let sw = video.videoWidth;
      let sh = video.videoHeight;

      if (video.videoWidth > video.videoHeight) {
        const offset = (video.videoWidth - video.videoHeight) / 2;
        sx = offset;
        sw = video.videoHeight;
      } else {
        const offset = (video.videoHeight - video.videoWidth) / 2;
        sy = offset;
        sh = video.videoWidth;
      }

      if (cameraMode === "user") {
        ctx.translate(outputSize, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, outputSize, outputSize);

      const jpegQ = Math.min(0.97, Math.max(0.9, prof.jpegQ || 0.94));

      let instantUrl = null;
      try {
        // Slightly lower Q for instant preview only (memory); final blob uses full Q
        instantUrl = canvas.toDataURL("image/jpeg", Math.min(0.88, jpegQ));
      } catch {
        instantUrl = null;
      }

      if (instantUrl) {
        usePostStore.setState({
          preview: { type: "image", data: instantUrl },
          selectedFile: null,
          isSizeMedia: null,
        });
        setCameraActive(false);
      }

      const finishWithBlob = (blob) => {
        capturingRef.current = false;
        if (!blob) {
          if (instantUrl) {
            try {
              const arr = instantUrl.split(",");
              const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
              const bstr = atob(arr[1]);
              const n = bstr.length;
              const u8 = new Uint8Array(n);
              for (let i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
              setMediaFromFile(
                new File([u8], "locket_dio.jpg", { type: mime }),
              );
            } catch {
              /* ignore */
            }
          }
          return;
        }
        setMediaFromFile(
          new File([blob], "locket_dio.jpg", { type: "image/jpeg" }),
        );
        setCameraActive(false);
      };

      // Final encode at high JPEG quality — no extra downscale
      const runBlob = () => {
        if (typeof canvas.toBlob === "function") {
          canvas.toBlob(finishWithBlob, "image/jpeg", jpegQ);
        } else {
          finishWithBlob(null);
        }
      };
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(runBlob, { timeout: 200 });
      } else {
        setTimeout(runBlob, 0);
      }
    };

    requestAnimationFrame(paintAndShow);
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
      clearTimeout(holdTimeoutRef.current);
      clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      onMouseDown={startHold}
      onMouseUp={endHold}
      onMouseLeave={(e) => {
        if (!isTryingToRecordRef.current && !isRecordingRef.current) return;
        clearTimeout(holdTimeoutRef.current);
        if (isRecordingRef.current) return;
        isTryingToRecordRef.current = false;
        holdStartTimeRef.current = null;
        setIsHolding(false);
      }}
      onTouchStart={startHold}
      onTouchEnd={endHold}
      onTouchCancel={() => {
        clearTimeout(holdTimeoutRef.current);
        isTryingToRecordRef.current = false;
        holdStartTimeRef.current = null;
        setIsHolding(false);
        if (
          isRecordingRef.current &&
          mediaRecorderRef.current?.state === "recording"
        ) {
          try {
            mediaRecorderRef.current.stop();
          } catch {
            /* ignore */
          }
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex items-center justify-center w-24 h-24 active:scale-97"
      style={{
        touchAction: "manipulation",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        className={`absolute w-20 h-20 border-camera-custome text-primary/80 rounded-full z-10 ${
          isHolding ? "animate-borderExpand" : ""
        }`}
      />
      <div
        className={`absolute rounded-full btn w-19 h-19 camera-inner-circle z-0 transition-all duration-300 ${
          isHolding ? "scale-77 opacity-90" : "scale-100 opacity-100"
        }`}
      />
    </button>
  );
};

export default CameraButton;
