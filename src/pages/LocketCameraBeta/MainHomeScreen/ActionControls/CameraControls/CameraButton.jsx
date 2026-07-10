import "./styles.css";
import React, { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { getVideoRecordLimit } from "@/hooks/useFeature";
import { CAMERA_CONFIG } from "@/config/configAlias";
import { detectAppEnvironment } from "@/utils/logic/checkIfRunningAsPWA";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { usePostStore } from "@/stores";
import { useTranslation } from "react-i18next";

const CameraButton = () => {
  const { t } = useTranslation("main");
  const { camera } = useApp();
  const {
    videoRef,
    streamRef,
    canvasRef,
    cameraRef,
    rotation,
    isHolding,
    setIsHolding,
    permissionChecked,
    setPermissionChecked,
    holdTime,
    setHoldTime,
    setRotation,
    cameraMode,
    setCameraMode,
    cameraActive,
    setCameraActive,
    setLoading,
    setDeviceId,
    setZoomLevel,
  } = camera;

  const setMediaFromFile = usePostStore((s) => s.setMediaFromFile);
  // usePostStore.setState used for instant preview in captureImage

  const holdStartTimeRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const intervalRef = useRef(null);
  const isTryingToRecordRef = useRef(false);
  const isRecordingRef = useRef(false);

  const MAX_RECORD_TIME = getVideoRecordLimit();

  const stopCamera = () => {
    console.log("Hello đang test camera à babi");
  };

  const startHold = (e) => {
    // Chỉ nhận chuột trái / touch — bỏ qua hover / nút khác
    if (e.type === "mousedown" && e.button !== 0) return;
    // Prevent default để tránh conflict trên iOS
    e.preventDefault();

    isTryingToRecordRef.current = true;
    isRecordingRef.current = false; // Reset recording state
    holdStartTimeRef.current = Date.now();

    holdTimeoutRef.current = setTimeout(() => {
      if (!isTryingToRecordRef.current) return;

      // Đánh dấu đang recording
      isRecordingRef.current = true;
      setIsHolding(true);

      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        SonnerInfo(t("home.camera_not_ready"));
        isTryingToRecordRef.current = false;
        setIsHolding(false);
        return;
      }

      // Tạo canvas vuông
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const side = Math.min(video.videoWidth, video.videoHeight);
      const outputSize = CAMERA_CONFIG.videoResolutionPx;
      canvas.width = outputSize;
      canvas.height = outputSize;

      // Điều chỉnh FPS dựa trên môi trường
      const targetFPS = detectAppEnvironment() ? 45 : undefined; // PWA: 45fps, Web: tự động
      const canvasStream = targetFPS
        ? canvas.captureStream(targetFPS)
        : canvas.captureStream();

      console.log(
        `🎥 Recording mode: ${detectAppEnvironment() ? "PWA" : "Web"}, FPS: ${
          targetFPS || "auto"
        }`
      );

      // Thử các MIME type khác nhau cho iOS
      let mimeType = "video/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/mp4";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ""; // Để MediaRecorder tự chọn
        }
      }

      // Cấu hình recorder options với bitrate phù hợp cho PWA
      const recorderOptions = mimeType ? { mimeType } : {};
      if (detectAppEnvironment() && mimeType) {
        // Nâng bitrate cho PWA để tăng chất lượng
        recorderOptions.videoBitsPerSecond = 5000000; // 5 Mbps
      } else if (mimeType) {
        // Web thường mạnh hơn => bitrate cao hơn
        recorderOptions.videoBitsPerSecond = 8000000; // 8 Mbps
      }

      const recorder = new MediaRecorder(canvasStream, recorderOptions);
      mediaRecorderRef.current = recorder;

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        console.log("📹 Video recording stopped, chunks:", chunks.length);

        if (chunks.length === 0) {
          console.error("No video data captured");
          return;
        }

        // Tạo blob với MIME type phù hợp
        const finalMimeType = mimeType || "video/mp4";
        const blob = new Blob(chunks, { type: finalMimeType });

        // Tạo file name với extension phù hợp
        const extension = finalMimeType.includes("webm") ? "webm" : "mp4";
        const file = new File([blob], `locket_dio.${extension}`, {
          type: finalMimeType,
        });

        console.log("📹 Video file created:", {
          size: file.size,
          type: file.type,
          name: file.name,
          environment: detectAppEnvironment() ? "PWA" : "Web",
        });

        setMediaFromFile(file);

        // const videoUrl = URL.createObjectURL(file);
        // const fileSizeInMB = file.size / (1024 * 1024);

        // setSizeMedia(fileSizeInMB.toFixed(2));
        // setPreview({ type: "video", data: videoUrl });
        // setSelectedFile(file);

        setCameraActive(false);
        stopCamera();
        setLoading(false);

        // Reset states
        isRecordingRef.current = false;
        setIsHolding(false);
      };

      recorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        isRecordingRef.current = false;
        setIsHolding(false);
      };

      try {
        recorder.start();
        console.log(
          "📹 Started recording with MIME type:",
          mimeType || "default"
        );
      } catch (error) {
        console.error("Failed to start recording:", error);
        isRecordingRef.current = false;
        setIsHolding(false);
        return;
      }

      // Hàm vẽ mỗi frame vào canvas với FPS control cho PWA
      let lastFrameTime = 0;
      const frameInterval = detectAppEnvironment() ? 1000 / 45 : 0; // 45fps cho PWA, unlimited cho web

      const drawFrame = (currentTime) => {
        if (video.paused || video.ended || recorder.state !== "recording") {
          return;
        }

        // Kiểm tra frame rate cho PWA
        if (
          detectAppEnvironment() &&
          currentTime - lastFrameTime < frameInterval
        ) {
          if (recorder.state === "recording") {
            requestAnimationFrame(drawFrame);
          }
          return;
        }

        lastFrameTime = currentTime;

        ctx.save();

        if (cameraMode === "user") {
          ctx.translate(outputSize, 0);
          ctx.scale(-1, 1);
        }

        const sx = (video.videoWidth - side) / 2;
        const sy = (video.videoHeight - side) / 2;
        ctx.drawImage(video, sx, sy, side, side, 0, 0, outputSize, outputSize);

        ctx.restore();

        if (recorder.state === "recording") {
          requestAnimationFrame(drawFrame);
        }
      };

      requestAnimationFrame(drawFrame);

      // Auto stop sau MAX_RECORD_TIME
      setTimeout(() => {
        if (recorder.state === "recording") {
          console.log("📹 Auto stopping recording after max time");
          recorder.stop();
        }
      }, MAX_RECORD_TIME * 1000);
    }, 600);
  };

  const endHold = (e) => {
    // Prevent default để tránh conflict trên iOS
    if (e?.preventDefault) e.preventDefault();

    // Chỉ xử lý khi đang giữ nút (mousedown/touchstart trước đó).
    // Tránh: di chuột ra khỏi nút (mouseleave) / hover → chụp nhầm.
    if (!isTryingToRecordRef.current && !isRecordingRef.current) {
      return;
    }

    const heldTime = Date.now() - (holdStartTimeRef.current || Date.now());

    // Clear timeouts
    clearTimeout(holdTimeoutRef.current);
    clearInterval(intervalRef.current);
    setHoldTime(heldTime);

    // Đánh dấu không còn trying to record
    const wasTrying = isTryingToRecordRef.current;
    isTryingToRecordRef.current = false;
    holdStartTimeRef.current = null;

    // Nếu đang trong quá trình recording
    if (
      isRecordingRef.current &&
      mediaRecorderRef.current?.state === "recording"
    ) {
      console.log("📹 Stopping video recording manually");
      mediaRecorderRef.current.stop();
      return; // Không chụp ảnh
    }

    // Nếu đã timeout và đang holding nhưng chưa bắt đầu record
    if (isHolding && !isRecordingRef.current) {
      setIsHolding(false);
      return;
    }

    // Chỉ chụp khi thả nút sau khi đã bấm (không chụp khi mouseleave)
    const isLeave =
      e?.type === "mouseleave" ||
      e?.type === "pointerleave" ||
      e?.type === "touchcancel";
    if (isLeave) {
      // Rời nút khi đang giữ: hủy, không chụp
      setIsHolding(false);
      return;
    }

    // Nếu không quay video (nhấn giữ < 600ms), tiến hành chụp ảnh
    if (wasTrying && !isRecordingRef.current) {
      captureImage();
    }
  };

  /**
   * Chụp ảnh — hiện preview NGAY (freeze + JPEG nhanh), không chờ encode xong.
   */
  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (!video.videoWidth || video.readyState < 2) {
      SonnerInfo(t("home.camera_not_ready"));
      return;
    }

    // 1) Freeze frame ngay lập tức (0ms) — user thấy ảnh đứng yên
    try {
      video.pause();
    } catch {
      /* ignore */
    }

    // 2) Vẽ + hiện preview ngay sau 1 frame (không chờ toBlob quality 1.0)
    const paintAndShow = () => {
      const maxSize = CAMERA_CONFIG.imageSizePx || 1920;
      // Encode nhanh hơn: cap 1440 trên máy yếu / mobile
      const cores = navigator.hardwareConcurrency || 4;
      const mem = navigator.deviceMemory || 4;
      const isLite =
        cores <= 4 ||
        mem <= 3 ||
        /Android/i.test(navigator.userAgent || "");
      const outputSize = isLite
        ? Math.min(maxSize, 1280)
        : Math.min(maxSize, 1600);

      canvas.width = outputSize;
      canvas.height = outputSize;

      const ctx = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });
      if (!ctx) return;

      // Reset transform mỗi lần chụp
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

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

      // 3) Preview tức thì bằng toDataURL (quality vừa — nhanh, vẫn đẹp)
      //    Rồi tắt cam + gắn file song song
      let instantUrl = null;
      try {
        instantUrl = canvas.toDataURL("image/jpeg", 0.88);
      } catch {
        instantUrl = null;
      }

      if (instantUrl) {
        // Hiện ảnh ngay — không chờ toBlob
        usePostStore.setState({
          preview: { type: "image", data: instantUrl },
          selectedFile: null,
          isSizeMedia: null,
        });
        setCameraActive(false);
      }

      // 4) File upload-ready (blob) — cập nhật khi xong, không block UI
      const finishWithBlob = (blob) => {
        if (!blob) {
          // Fallback: dataURL → File nếu toBlob fail
          if (instantUrl) {
            try {
              const arr = instantUrl.split(",");
              const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
              const bstr = atob(arr[1]);
              const n = bstr.length;
              const u8 = new Uint8Array(n);
              for (let i = 0; i < n; i++) u8[i] = bstr.charCodeAt(i);
              const file = new File([u8], "locket_dio.jpg", { type: mime });
              setMediaFromFile(file);
            } catch {
              /* ignore */
            }
          }
          return;
        }
        const file = new File([blob], "locket_dio.jpg", {
          type: "image/jpeg",
        });
        // setMediaFromFile tạo blob URL mới — thay preview dataURL (tiết kiệm RAM)
        setMediaFromFile(file);
        setCameraActive(false);
      };

      if (typeof canvas.toBlob === "function") {
        canvas.toBlob(finishWithBlob, "image/jpeg", 0.9);
      } else {
        finishWithBlob(null);
      }
    };

    // 1 frame: paint freeze đã hiện, rồi encode (user thấy đứng hình ngay)
    requestAnimationFrame(paintAndShow);
  };

  // Cleanup khi component unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      clearTimeout(holdTimeoutRef.current);
      clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onMouseDown={startHold}
        onMouseUp={endHold}
        // Không gắn endHold vào mouseleave — di chuột ra ngoài không được chụp
        onMouseLeave={(e) => {
          // Chỉ hủy trạng thái giữ, không captureImage
          if (!isTryingToRecordRef.current && !isRecordingRef.current) return;
          clearTimeout(holdTimeoutRef.current);
          // Nếu đang quay video thì giữ recording (user có thể thả ngoài nút)
          if (isRecordingRef.current) return;
          isTryingToRecordRef.current = false;
          holdStartTimeRef.current = null;
          setIsHolding(false);
        }}
        onTouchStart={startHold}
        onTouchEnd={endHold}
        // Thêm các event cho iOS
        onTouchCancel={(e) => {
          // Hủy, không chụp
          clearTimeout(holdTimeoutRef.current);
          isTryingToRecordRef.current = false;
          holdStartTimeRef.current = null;
          setIsHolding(false);
          if (isRecordingRef.current && mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
          }
        }}
        onContextMenu={(e) => e.preventDefault()} // Prevent long press menu on iOS
        className="relative flex items-center justify-center w-24 h-24 active:scale-97"
        style={{
          touchAction: "manipulation", // Improve touch response on iOS
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div
          className={`absolute w-20 h-20 border-camera-custome text-primary/80 rounded-full z-10 ${
            isHolding ? "animate-borderExpand" : ""
          }`}
        ></div>
        <div
          className={`absolute rounded-full btn w-19 h-19 camera-inner-circle z-0 transition-all duration-500 ${
            isHolding ? "scale-77 opacity-90" : "scale-100 opacity-100"
          }`}
        ></div>
      </button>
    </>
  );
};

export default CameraButton;
