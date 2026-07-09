import React, { lazy, Suspense, useCallback, useEffect, useRef } from "react";

import MediaSizeInfo from "@/components/ui/MediaSizeInfo";
import BorderProgress from "./SquareProgress";
import { showInfo } from "@/components/Toast";
import { getAvailableCameras } from "@/utils";
const AutoResizeCaption = lazy(() => import("./CaptionViews"));
import { useApp } from "@/context/AppContext";
import {
  openCameraStream,
  stopMediaStream,
} from "@/utils/device/cameraStream";

const MediaPreview = ({ capturedMedia }) => {
  const { post, camera } = useApp();
  const { selectedFile, preview } = post;
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
    selectedFrame,
  } = camera;

  const startingRef = useRef(false);
  const mountedRef = useRef(true);

  const stopCamera = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    startingRef.current = false;
  }, [streamRef, videoRef]);

  const startCamera = useCallback(async () => {
    if (!cameraActive || preview || selectedFile || capturedMedia) return;
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      const stream = await openCameraStream({
        facingMode: cameraMode || "user",
        deviceId: deviceId || null,
      });
      if (!mountedRef.current) {
        stopMediaStream(stream);
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const p = videoRef.current.play?.();
        if (p?.catch) p.catch(() => {});
      }
    } catch (err) {
      console.error("startCamera failed:", err);
      setCameraActive(false);
    } finally {
      startingRef.current = false;
    }
  }, [
    cameraActive,
    cameraMode,
    deviceId,
    preview,
    selectedFile,
    capturedMedia,
    setCameraActive,
    streamRef,
    videoRef,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!cameraActive || preview || selectedFile || capturedMedia) {
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
    capturedMedia,
    startCamera,
    stopCamera,
  ]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!preview && !selectedFile && !capturedMedia && !cameraActive) {
      setCameraActive(true);
    }
  }, [preview, selectedFile, capturedMedia, setCameraActive, cameraActive]);

  const handleCycleZoomCamera = async () => {
    try {
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
          newZoom = "0.5x";
          newDeviceId = cameras?.backUltraWideCamera?.deviceId;
        } else if (zoomLevel === "0.5x") {
          newZoom = "3x";
          newDeviceId = cameras?.backZoomCamera?.deviceId;
        } else {
          newZoom = "1x";
          newDeviceId = cameras?.backNormalCamera?.deviceId;
        }
        if (!newDeviceId && zoomLevel !== "1x") {
          newZoom = "1x";
          newDeviceId =
            cameras?.backNormalCamera?.deviceId ||
            cameras?.backCameras?.[0]?.deviceId;
        }
      }

      if (newDeviceId) {
        setZoomLevel(newZoom);
        setDeviceId(newDeviceId);
      } else {
        showInfo("Thiết bị không hỗ trợ đổi zoom camera");
      }
    } catch (e) {
      showInfo("Không đổi được zoom camera");
    }
  };

  const showLive =
    !preview && !selectedFile && !capturedMedia && cameraActive;

  return (
    <>
      <h1 className="text-3xl mb-1.5 font-semibold font-lovehouse">
        Locket Camera
      </h1>
      <div className="relative w-full max-w-md aspect-square bg-gray-800 rounded-[65px] overflow-hidden">
        {showLive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${
              cameraMode === "user" ? "scale-x-[-1]" : ""
            }`}
          />
        )}

        {!preview && !selectedFile && (
          <>
            <div className="absolute inset-0 top-7 px-7 z-30 pointer-events-none flex justify-between text-base-content text-xs font-semibold">
              <button
                type="button"
                onClick={() => showInfo("Chức năng này sẽ sớm có mặt!")}
                className="pointer-events-auto w-7 h-7 p-1.5 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center"
              >
                <img src="/icons/bolt.fill.png" alt="Icon sấm sét" />
              </button>
              <button
                type="button"
                onClick={handleCycleZoomCamera}
                className="pointer-events-auto w-6 h-6 text-primary-content font-semibold rounded-full bg-white/30 backdrop-blur-md p-3.5 flex items-center justify-center"
              >
                {zoomLevel}
              </button>
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
          className={`absolute z-10 inset-x-0 bottom-0 px-4 pb-4 ${
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

      <div className="mt-2 text-sm flex items-center justify-center pl-3">
        <MediaSizeInfo />
      </div>
    </>
  );
};

export default MediaPreview;
