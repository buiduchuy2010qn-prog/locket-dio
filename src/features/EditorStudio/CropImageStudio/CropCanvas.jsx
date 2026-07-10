import clsx from "clsx";
import Cropper from "react-easy-crop";
import CropLoading from "./CropLoading";

const CropCanvas = ({
  converting,
  imageUrl,
  crop,
  zoom,
  setCrop,
  setZoom,
  setCroppedAreaPixels,
}) => {
  return (
    <div className="flex-1 h-[calc(100vh-180px)] relative overflow-hidden">
      {/* Cropper */}
      <div
        className={clsx(
          "absolute inset-0 transition-opacity duration-300",
          converting ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
      >
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
          cropShape="rect"
          showGrid
          zoomWithScroll
          touchAction="pan"
          objectFit="contain"
          restrictPosition
        />
      </div>

      {/* Loading */}
      <div
        className={clsx(
          "absolute inset-0 transition-opacity duration-300",
          converting ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <CropLoading />
      </div>
    </div>
  );
};

export default CropCanvas;
