import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  getAvailableCameras,
  isIOS,
  pickCameraDeviceId,
  getMainBackCameraId,
  isDeviceUltraWide,
} from "@/utils";
const EditorCaption = lazy(() => import("@/features/EditorCaption"));
import { useApp } from "@/context/AppContext";
import { CONFIG } from "@/config";
import BorderProgress from "../../Widgets/SquareProgress";
import { SonnerInfo } from "@/components/ui/SonnerToast";
import { usePostStore, useUIStore } from "@/stores";
import { useTranslation } from "react-i18next";

const MediaPreviewIOS = () => {
  const { useloading, camera } = useApp();
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
  } = camera;
  const { setSendLoading } = useloading;

  const cameraInitialized = useRef(false);
  const lastCameraMode = useRef(cameraMode);
  const lastDeviceId = useRef(deviceId);
  const [lensPills, setLensPills] = useState(["1x"]);

  const cameraFrame = useUIStore((s) => s.cameraFrame);

  const refreshLensPills = async () => {
    const pills = new Set(["1x"]);
    try {
      const cameras = await getAvailableCameras();
      if (cameras?.backUltraWideCamera) pills.add("0.5x");
      if (cameras?.backZoomCamera) pills.add("3x");
    } catch {
      /* ignore */
    }
    const order = ["0.5x", "1x", "2x", "3x"];
    setLensPills(order.filter((z) => pills.has(z)));
  };

  const handleSelectLens = async (label) => {
    if (cameraMode !== "environment") return;
    const cameras = await getAvailableCameras();
    let newDeviceId = null;
    if (label === "1x") {
      newDeviceId =
        cameras?.backNormalCamera?.deviceId || (await getMainBackCameraId());
    } else if (label === "0.5x") {
      newDeviceId =
        cameras?.backUltraWideCamera?.deviceId ||
        cameras?.backNormalCamera?.deviceId;
    } else {
      newDeviceId =
        cameras?.backZoomCamera?.deviceId ||
        cameras?.backNormalCamera?.deviceId ||
        (await getMainBackCameraId());
    }
    if (!newDeviceId) {
      SonnerInfo(t("home.camera_no_zoom"));
      return;
    }
    setZoomLevel(label);
    setDeviceId(newDeviceId);
    setCameraActive(false);
    setTimeout(() => setCameraActive(true), 250);
  };

  const iosDevice = isIOS();
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    cameraInitialized.current = false;
  };

  const startCamera = async () => {
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
      let resolvedDeviceId = deviceId;

      // 1x camera sau → BẮT BUỘC main trên mọi máy
      if (isBack && z === "1x") {
        resolvedDeviceId = await getMainBackCameraId();
      } else if (!resolvedDeviceId) {
        resolvedDeviceId = await pickCameraDeviceId(
          mode,
          z === "0.5x" ? "0.5x" : z,
        );
      } else if (isBack && z === "1x" && (await isDeviceUltraWide(resolvedDeviceId))) {
        resolvedDeviceId = await getMainBackCameraId();
      }

      if (resolvedDeviceId) setDeviceId(resolvedDeviceId);

      const quality = CONFIG.app.camera.constraints.default;
      let stream = null;

      if (resolvedDeviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: resolvedDeviceId }, ...quality },
            audio: false,
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { ideal: resolvedDeviceId }, ...quality },
              audio: false,
            });
          } catch {
            stream = null;
          }
        }
      }

      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, ...quality },
          audio: false,
        });
      }

      // iOS: nếu 1x mà dính ultra → mở lại main
      if (isBack && z === "1x" && resolvedDeviceId) {
        const actualId = stream.getVideoTracks?.()?.[0]?.getSettings?.()?.deviceId;
        if (actualId && (await isDeviceUltraWide(actualId))) {
          const mainId = await getMainBackCameraId();
          if (mainId) {
            stream.getTracks().forEach((t) => t.stop());
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: mainId }, ...quality },
                audio: false,
              });
              setDeviceId(mainId);
            } catch {
              /* keep previous */
            }
          }
        }
      }

      streamRef.current = stream;
      cameraInitialized.current = true;
      lastCameraMode.current = cameraMode;
      lastDeviceId.current = resolvedDeviceId || deviceId;
      refreshLensPills();

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
    } catch (err) {
      setCameraActive(false);
      cameraInitialized.current = false;
    }
  };

  useEffect(() => {
    if (cameraActive && !preview && !selectedFile) {
      startCamera();
    } else if (!cameraActive || preview || selectedFile) {
      if (streamRef.current) {
        stopCamera();
      }
    }
  }, [cameraActive, cameraMode, deviceId, preview, selectedFile]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      cameraInitialized.current = false;
    };
  }, []);

  useEffect(() => {
    if (!preview && !selectedFile && !cameraActive) {
      setCameraActive(true);
    }
  }, [preview, selectedFile, cameraActive]);

  const handleCycleZoomCamera = async () => {
    const cameras = await getAvailableCameras();
    const isBackCamera = cameraMode === "environment";
    const isFrontCamera = cameraMode === "user";

    let newZoom = "1x";
    let newDeviceId = null;

    if (isFrontCamera) {
      newZoom = zoomLevel === "1x" ? "0.5x" : "1x";
      newDeviceId = cameras?.frontCameras?.[0]?.deviceId;
    } else if (isBackCamera) {
      if (zoomLevel === "1x") {
        if (cameras?.backUltraWideCamera?.deviceId) {
          newZoom = "0.5x";
          newDeviceId = cameras.backUltraWideCamera.deviceId;
        } else if (cameras?.backZoomCamera?.deviceId) {
          newZoom = "3x";
          newDeviceId = cameras.backZoomCamera.deviceId;
        }
      } else if (zoomLevel === "0.5x") {
        if (cameras?.backZoomCamera?.deviceId) {
          newZoom = "3x";
          newDeviceId = cameras.backZoomCamera.deviceId;
        } else {
          newZoom = "1x";
          newDeviceId =
            cameras?.backNormalCamera?.deviceId ||
            (await getMainBackCameraId());
        }
      } else {
        // 2x/3x → 1x main bắt buộc
        newZoom = "1x";
        newDeviceId =
          cameras?.backNormalCamera?.deviceId || (await getMainBackCameraId());
      }

      if (newZoom === "1x") {
        newDeviceId =
          cameras?.backNormalCamera?.deviceId ||
          (await getMainBackCameraId()) ||
          newDeviceId;
      }
    }

    if (newDeviceId) {
      setZoomLevel(newZoom);
      setDeviceId(newDeviceId);
      setCameraActive(false);
      setTimeout(() => setCameraActive(true), 300);
    } else {
      SonnerInfo(t("home.camera_no_zoom"));
    }
  };

  return (
    <>
      <div
        className={`relative w-full max-w-md aspect-square bg-gray-800 rounded-[65px] overflow-hidden transition-transform duration-500 `}
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
                onClick={() => SonnerInfo(t("home.feature_coming_soon"))}
                className="pointer-events-auto w-7 h-7 p-1.5 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center"
              >
                <img src="/icons/bolt.fill.png" alt="Icon sấm sét" />
              </button>

              <button
                onClick={handleCycleZoomCamera}
                className="pointer-events-auto min-w-8 h-8 px-2 text-primary-content font-semibold rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-xs"
              >
                {zoomLevel}
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
            style={{ imageRendering: "auto", WebkitUserDrag: "none" }}
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

export default MediaPreviewIOS;
