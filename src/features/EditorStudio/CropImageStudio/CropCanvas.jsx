import clsx from "clsx";
import { useCallback } from "react";
import Cropper from "react-easy-crop";
import CropLoading from "./CropLoading";

/**
 * Canvas crop 1:1 (Locket). objectFit cover + onMediaLoaded → mượt, không xám.
 */
const CropCanvas = ({
  converting,
  imageUrl,
  crop,
  zoom,
  minZoom = 1,
  setCrop,
  setZoom,
  setMinZoom,
  setCroppedAreaPixels,
  onMediaReady,
  onMediaError,
}) => {
  const onMediaLoaded = useCallback(
    (mediaSize) => {
      // cover 1:1 — minZoom 1 lấp khung
      const nextMin = 1;
      setMinZoom?.(nextMin);
      setZoom?.((z) => Math.max(nextMin, Number(z) || 1));
      if (mediaSize?.width > 0) onMediaReady?.();
    },
    [onMediaReady, setMinZoom, setZoom],
  );

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden bg-neutral-900">
      <div
        className={clsx(
          "absolute inset-0 transition-opacity duration-200",
          converting || !imageUrl
            ? "opacity-0 pointer-events-none"
            : "opacity-100",
        )}
      >
        {imageUrl ? (
          <Cropper
            key={imageUrl}
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            minZoom={minZoom}
            maxZoom={4}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => {
              if (pixels?.width > 0 && pixels?.height > 0) {
                setCroppedAreaPixels(pixels);
              }
            }}
            onMediaLoaded={onMediaLoaded}
            // Một số bản react-easy-crop không có onError — fallback timeout ở parent
            cropShape="rect"
            showGrid
            zoomWithScroll
            objectFit="cover"
            restrictPosition
            style={{
              containerStyle: {
                background: "#171717",
              },
              mediaStyle: {
                // Tránh flash xám
                opacity: 1,
              },
            }}
          />
        ) : null}
      </div>

      {/* Ảnh lỗi / chưa load: nền tối + hint, không xám mờ */}
      {!converting && imageUrl && (
        <div
          className="absolute inset-0 -z-10 bg-neutral-900"
          aria-hidden
        />
      )}

      <div
        className={clsx(
          "absolute inset-0 transition-opacity duration-200 z-10",
          converting ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <CropLoading />
      </div>
    </div>
  );
};

export default CropCanvas;
