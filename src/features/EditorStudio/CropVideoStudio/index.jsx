import React, { useEffect, useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { Scissors, X } from "lucide-react";
import { usePostStore } from "@/stores";
import clsx from "clsx";
import { getFileSizeMB } from "@/utils";
import { useFeatureVisible } from "@/hooks/useFeature";
import { useTranslation } from "react-i18next";

const CropVideoStudio = () => {
  const { t } = useTranslation("features");
  const canCropMedia = useFeatureVisible("video_crop_tool");

  const setMediaFromFile = usePostStore((s) => s.setMediaFromFile);
  const videoToCrop = usePostStore((s) => s.videoToCrop);
  const setVideoToCrop = usePostStore((s) => s.setVideoToCrop);
  const setVideoCropData = usePostStore((s) => s.setVideoCropData);
  const setVideoCropArea = usePostStore((s) => s.setVideoCropArea);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropError, setCropError] = useState("");
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    let url;
    if (videoToCrop) {
      url = URL.createObjectURL(videoToCrop);
      setVideoUrl(url);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [videoToCrop]);

  const handleConfirm = useCallback(() => {
    if (!croppedArea || !croppedAreaPixels || !videoToCrop) return;
    try {
      setMediaFromFile(videoToCrop);
      setVideoCropData({
        x: croppedArea.x,
        y: croppedArea.y,
        width: croppedArea.width,
        height: croppedArea.height,
        pixels: croppedAreaPixels,
      });
      setVideoCropArea(croppedAreaPixels);
      setVideoToCrop(null); // ✅ Ẩn cropper sau khi cắt
    } catch (e) {
      console.error("Crop failed", e);
      setCropError(t("crop_video.crop_failed"));
    }
  }, [croppedArea, croppedAreaPixels, videoToCrop]);

  useEffect(() => {
    if (videoToCrop) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    }
  }, [videoToCrop]);

  const [showCropper, setShowCropper] = useState(false);

  useEffect(() => {
    if (videoToCrop) {
      setShowCropper(true);
    } else {
      const timer = setTimeout(() => setShowCropper(false), 300);
      return () => clearTimeout(timer);
    }
  }, [videoToCrop]);

  useEffect(() => {
    document.body.style.overflow = videoToCrop ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [videoToCrop]);

  const fileName = videoToCrop?.name;
  const fileType = videoToCrop?.type;
  const fileSizeMB = getFileSizeMB(videoToCrop);
  const fileExt = videoToCrop?.name?.split(".").pop()?.toLowerCase();

  // Nếu feature crop_media_tool bị tắt: bỏ qua crop, dùng nguyên file
  useEffect(() => {
    if (videoToCrop && !canCropMedia) {
      setMediaFromFile(videoToCrop);
      setVideoToCrop(null);
    }
  }, [videoToCrop, canCropMedia]);

  if (!showCropper || !canCropMedia) return null;

  return (
    <div
      className={clsx(
        "fixed flex flex-col inset-0 z-50 bg-base-100/30 backdrop-blur-xl transition-all duration-500 ease-in-out overflow-hidden",
        {
          "opacity-100": videoToCrop,
          "opacity-0 pointer-events-none": !videoToCrop,
        },
      )}
    >
      {/* Cropper Area */}
      <div className="flex-1 h-[calc(100vh-180px)] flex items-center justify-center relative">
        {videoUrl && (
          <Cropper
            video={videoUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(area, pixels) => {
              setCroppedArea(area);
              setCroppedAreaPixels(pixels);
            }}
            cropShape="rect"
            showGrid={true}
            zoomWithScroll={true}
            touchAction="pan"
            restrictPosition={true}
            mediaProps={{
              autoPlay: true,
              muted: true,
              playsInline: true,
              loop: true,
            }}
            style={{
              containerStyle: {
                width: "100%",
                height: "100%",
              },
            }}
          />
        )}
      </div>

      {/* Footer Buttons */}
      <div className="w-full border-t border-base-300 bg-base-200 -mt-6 p-4 shadow-lg z-10 relative rounded-t-3xl">
        <h1 className="text-xl font-lovehouse text-left text-base-content">
          {t("crop_video.title")}
        </h1>

        <p className="text-sm text-left text-gray-600 mt-1">
          {t("crop_video.instruction")}
        </p>

        {/* 📌 Metadata */}
        {videoToCrop && (
          <div className="mt-2 text-xs text-gray-500 space-y-1">
            <p>📄 {t("crop_image.metadata.name")}: {fileName}</p>
            <p>📦 {t("crop_image.metadata.type")}: {fileType}</p>
            <p>🧩 {t("crop_image.metadata.extension")}: {fileExt}</p>
            <p>💾 {t("crop_image.metadata.size")}: {fileSizeMB} MB</p>
          </div>
        )}

        {cropError && (
          <p className="text-sm text-left text-red-500 font-medium mt-2 break-words">
            {cropError}
          </p>
        )}

        <div className="flex justify-center gap-4 pt-2">
          <button
            onClick={() => setVideoToCrop(null)}
            className="btn btn-outline btn-error rounded-3xl"
          >
            <X />
            {t("crop_video.cancel")}
          </button>

          <button
            onClick={handleConfirm}
            className="btn btn-primary rounded-3xl"
          >
            <Scissors />
            {t("crop_video.save_crop")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CropVideoStudio;
