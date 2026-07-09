import React, { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { RefreshCcw } from "lucide-react";
import UploadFile from "./UploadFile";
import { showError } from "@/components/Toast";
import { getVideoRecordLimit } from "@/hooks/useFeature";
import { CAMERA_CONFIG } from "@/config/configAlias";
import { detectAppEnvironment } from "@/utils/logic/checkIfRunningAsPWA";

const CameraButton = () => {
  const { camera, post, useloading } = useApp();
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
    setZoomFactor,
  } = camera;
  const { preview, setPreview, setSelectedFile, setSizeMedia } = post;
  const { setIsCaptionLoading, uploadLoading, setUploadLoading } = useloading;

  const holdStartTimeRef = useRef(null);
  const holdTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const intervalRef = useRef(null);
  const isTryingToRecordRef = useRef(false);
  const isRecordingRef = useRef(false);
  /** true chỉ khi đã mousedown/touchstart trên nút chụp */
  const pressActiveRef = useRef(false);

  const MAX_RECORD_TIME = getVideoRecordLimit();

  // Stream lifecycle is owned by MediaPreview (start/stop on mode change)


  const startHold = (e) => {
    // Prevent default để tránh conflict trên iOS
    e.preventDefault();
    // Chỉ nhận pointer/touch chính (tránh di chuột lướt qua)
    if (e.type === "mousedown" && e.button !== 0) return;
    if (e.type.startsWith("mouse") && e.buttons === 0 && e.type !== "mousedown")
      return;

    pressActiveRef.current = true;
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
        showError("Camera chưa sẵn sàng, vui lòng chờ giây lát...");
        isTryingToRecordRef.current = false;
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

        const videoUrl = URL.createObjectURL(file);
        const fileSizeInMB = file.size / (1024 * 1024);

        setSizeMedia(fileSizeInMB.toFixed(2));
        setPreview({ type: "video", data: videoUrl });
        setSelectedFile(file);
        setCameraActive(false);
        setIsCaptionLoading(true);
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
        if (detectAppEnvironment() && currentTime - lastFrameTime < frameInterval) {
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

  /** Hủy nhấn (chuột rời nút) — KHÔNG chụp, chỉ dừng record nếu đang quay */
  const cancelHold = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!pressActiveRef.current) return;

    clearTimeout(holdTimeoutRef.current);
    clearInterval(intervalRef.current);
    isTryingToRecordRef.current = false;

    // Đang quay video → dừng và lưu video
    if (
      isRecordingRef.current &&
      mediaRecorderRef.current?.state === "recording"
    ) {
      console.log("📹 Stopping video recording (cancel/leave)");
      mediaRecorderRef.current.stop();
      pressActiveRef.current = false;
      setIsHolding(false);
      return;
    }

    // Chưa quay xong / chỉ lướt chuột → hủy, không chụp
    pressActiveRef.current = false;
    isRecordingRef.current = false;
    setIsHolding(false);
  };

  const endHold = (e) => {
    // Prevent default để tránh conflict trên iOS
    if (e?.preventDefault) e.preventDefault();

    // Chưa từng nhấn nút (chỉ di chuột / mouseleave) → bỏ qua, không chụp
    if (!pressActiveRef.current) return;
    pressActiveRef.current = false;

    const heldTime = Date.now() - (holdStartTimeRef.current || Date.now());

    // Clear timeouts
    clearTimeout(holdTimeoutRef.current);
    clearInterval(intervalRef.current);
    setHoldTime(heldTime);

    // Đánh dấu không còn trying to record
    isTryingToRecordRef.current = false;

    // Nếu đang trong quá trình recording
    if (
      isRecordingRef.current &&
      mediaRecorderRef.current?.state === "recording"
    ) {
      console.log("📹 Stopping video recording manually");
      mediaRecorderRef.current.stop();
      setIsHolding(false);
      return; // Không chụp ảnh
    }

    // Nếu đã timeout và đang holding nhưng chưa bắt đầu record
    if (isHolding && !isRecordingRef.current) {
      setIsHolding(false);
      return;
    }

    // Chỉ chụp khi thả nút sau khi đã nhấn (nhấn giữ < ~600ms)
    if (!isRecordingRef.current) {
      captureImage();
    }
    setIsHolding(false);
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    canvas.width = CAMERA_CONFIG.imageSizePx;
    canvas.height = CAMERA_CONFIG.imageSizePx;

    let sx = 0,
      sy = 0,
      sw = video.videoWidth,
      sh = video.videoHeight;

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
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "locket_dio.jpg", {
            type: "image/jpeg",
          });
          const imgUrl = URL.createObjectURL(file);
          setPreview({ type: "image", data: imgUrl });

          const fileSizeInMB = file.size / (1024 * 1024);
          setSizeMedia(fileSizeInMB.toFixed(2));

          setSelectedFile(file);
          setIsCaptionLoading(true);
          setCameraActive(false);
        }
      },
      "image/jpeg",
      0.82
    );

    // Fix iOS
    setTimeout(() => {
      const videoEl = document.querySelector("video");
      if (videoEl) videoEl.setAttribute("playsinline", "true");
    }, 100);
  };

  // Flip front/back — MediaPreview restarts stream (do not open stream here)
  const handleRotateCamera = () => {
    if (uploadLoading || preview) return;
    setRotation((prev) => prev - 180);
    const newMode = cameraMode === "user" ? "environment" : "user";
    setZoomLevel("1x");
    setZoomFactor?.(1);
    // Clear deviceId first so we don't keep front lens id when going to back
    setDeviceId(null);
    setCameraMode(newMode);
    setCameraActive(true);
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
      <div className="flex gap-4 w-full max-w-md justify-evenly items-center">
        <UploadFile />
        <button
          type="button"
          onMouseDown={startHold}
          onMouseUp={endHold}
          // Di chuột ra ngoài khi đang giữ → hủy, KHÔNG chụp
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={endHold}
          onTouchCancel={cancelHold}
          onContextMenu={(e) => e.preventDefault()}
          className="relative flex items-center justify-center w-22 h-22"
          style={{
            touchAction: "manipulation",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          <div
            className={`absolute w-22 h-22 border-5 border-base-content/50 rounded-full z-10 ${
              isHolding ? "animate-lightPulse" : ""
            }`}
          ></div>
          <div
            className={`absolute rounded-full btn w-18 h-18 outline-accent bg-base-content z-0 ${
              isHolding ? "animate-pulseBeat" : ""
            }`}
          ></div>
        </button>
        <button className="cursor-pointer" onClick={handleRotateCamera}>
          <RefreshCcw
            size={35}
            className="transition-transform duration-500"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </button>
      </div>
    </>
  );
};

export default CameraButton;
