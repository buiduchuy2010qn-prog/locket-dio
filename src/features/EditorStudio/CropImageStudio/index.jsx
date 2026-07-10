import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCroppedImg, getFileSizeMB } from "@/utils";
import clsx from "clsx";
import { usePostStore } from "@/stores";
import { convertImageToBlob } from "@/services";
import CropCanvas from "./CropCanvas";
import CropFooter from "./CropFooter";

const CropImageStudio = () => {
  const { t } = useTranslation("features");
  const setMediaFromFile = usePostStore((s) => s.setMediaFromFile);
  const imageToCrop = usePostStore((s) => s.imageToCrop);
  const setImageToCrop = usePostStore((s) => s.setImageToCrop);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropError, setCropError] = useState("");

  const [imageUrl, setImageUrl] = useState(null);
  const [converting, setConverting] = useState(false);
  const [canRenderImage, setCanRenderImage] = useState(null);

  const canBrowserRenderImage = useCallback((file) => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(true);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };

      img.src = url;
    });
  }, []);
  useEffect(() => {
    let ignore = false;

    setCanRenderImage(false);

    const check = async () => {
      if (!imageToCrop) return;

      const ok = await canBrowserRenderImage(imageToCrop);

      if (!ignore) {
        setCanRenderImage(ok);
      }
    };

    check();

    return () => {
      ignore = true;
    };
  }, [imageToCrop]);

  useEffect(() => {
    let url;

    if (imageToCrop) {
      url = URL.createObjectURL(imageToCrop);
      setImageUrl(url);
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageToCrop]);

  const handleConvertImage = async () => {
    if (!imageToCrop) return;

    try {
      setConverting(true);

      const blob = await convertImageToBlob(imageToCrop);

      const ext = blob.type === "image/webp" ? "webp" : "jpg";

      const file = new File(
        [blob],
        imageToCrop.name.replace(/\.[^.]+$/, `.${ext}`),
        {
          type: blob.type,
          lastModified: Date.now(),
        },
      );

      file.__converted = true;

      setImageToCrop(file);
    } catch (err) {
      console.error(err);
    } finally {
      setConverting(false);
    }
  };

  const handleCropConfirm = useCallback(async () => {
    if (!croppedAreaPixels || !imageToCrop) return;

    try {
      const croppedFile = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setMediaFromFile(croppedFile);
      setImageToCrop(null); // ✅ Ẩn cropper sau khi cắt
    } catch (e) {
      console.error("Crop failed", e);

      let msg = t("crop_image.crop_failed_default");

      if (e instanceof Error) {
        msg = e.message;
      } else if (typeof e === "object") {
        msg = JSON.stringify(e);
      } else {
        msg = String(e);
      }

      setCropError(t("crop_image.crop_failed_detail", { error: msg }));
    }
  }, [croppedAreaPixels, imageToCrop]);

  // Effect để reset crop và zoom khi có ảnh mới
  useEffect(() => {
    if (imageToCrop) {
      setCrop({ x: 0, y: 0 });
      setZoom(1); // Reset zoom về 1 để ảnh lấp đầy khung
    }
  }, [imageToCrop]);

  const [showCropper, setShowCropper] = useState(false);

  // Mỗi khi imageToCrop thay đổi, xử lý hiệu ứng mở/đóng
  useEffect(() => {
    if (imageToCrop) {
      setShowCropper(true); // Mở cropper
    } else {
      // Đóng cropper sau hiệu ứng (300ms)
      const timer = setTimeout(() => setShowCropper(false), 300);
      return () => clearTimeout(timer);
    }
  }, [imageToCrop]);

  //Khoá cuộn màn hình cho thẻ body
  useEffect(() => {
    document.body.style.overflow = imageToCrop ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [imageToCrop]);

  const fileName = imageToCrop?.name;
  const fileType = imageToCrop?.type;
  const fileSizeMB = getFileSizeMB(imageToCrop);
  const fileExt = imageToCrop?.name?.split(".").pop()?.toLowerCase();

  const needConvert = imageToCrop && canRenderImage === false;

  const canSkipCrop = imageToCrop && canRenderImage === true;

  const shouldDisableCrop = needConvert && !imageToCrop?.__converted;

  const handleSkipCrop = () => {
    if (!imageToCrop) return;

    setMediaFromFile(imageToCrop);
    setImageToCrop(null);
  };

  if (!showCropper) return null;

  return (
    <div
      className={clsx(
        "fixed flex flex-col inset-0 z-50 bg-base-100/30 backdrop-blur-xl transition-all duration-500 ease-in-out overflow-hidden",
        {
          "opacity-100": imageToCrop,
          "opacity-0 pointer-events-none": !imageToCrop,
        },
      )}
    >
      {/* Cropper Area */}
      <CropCanvas
        converting={converting}
        imageUrl={imageUrl}
        crop={crop}
        zoom={zoom}
        setCrop={setCrop}
        setZoom={setZoom}
        setCroppedAreaPixels={setCroppedAreaPixels}
      />

      {/* Footer Buttons */}
      <CropFooter
        imageToCrop={imageToCrop}
        needConvert={needConvert}
        converting={converting}
        cropDisabled={shouldDisableCrop}
        cropError={cropError}
        fileName={fileName}
        fileType={fileType}
        fileExt={fileExt}
        fileSizeMB={fileSizeMB}
        onCancel={() => setImageToCrop(null)}
        onConvert={handleConvertImage}
        onCrop={handleCropConfirm}
        canSkipCrop={canSkipCrop}
        onSkip={handleSkipCrop}
      />
    </div>
  );
};

export default CropImageStudio;
