import { Repeat2, Scissors, X, ImageOff } from "lucide-react";
import ImageMetadata from "./ImageMetadata";
import { useTranslation } from "react-i18next";

const CropFooter = ({
  imageToCrop,
  needConvert,
  converting,
  cropDisabled,
  cropError,
  fileName,
  fileType,
  fileExt,
  fileSizeMB,
  onCancel,
  onConvert,
  onCrop,
  canSkipCrop,
  onSkip,
}) => {
  const { t } = useTranslation("features");

  return (
    <div className="w-full border-t border-base-300 bg-base-200 -mt-6 p-4 shadow-lg z-10 relative rounded-t-3xl">
      <h1 className="text-xl font-lovehouse text-left text-base-content">
        {t("crop_image.title")}
      </h1>

      <div className="my-1 space-y-1 text-xs text-base-content/80">
        <p>{t("crop_image.instruction_zoom")}</p>
        <p>{t("crop_image.instruction_convert")}</p>
      </div>

      {/* 📌 Metadata */}
      {imageToCrop && (
        <ImageMetadata
          fileName={fileName}
          fileType={fileType}
          fileExt={fileExt}
          fileSizeMB={fileSizeMB}
        />
      )}

      {cropError && (
        <p className="text-sm text-left text-red-500 font-medium mt-2 break-words">
          {cropError}
        </p>
      )}

      <div className="flex justify-center gap-2 pt-2">
        <button
          onClick={onCancel}
          className="btn btn-outline btn-error rounded-3xl"
        >
          <X />
          {t("crop_image.cancel")}
        </button>

        {needConvert && (
          <button
            onClick={onConvert}
            className="btn btn-secondary rounded-3xl"
            disabled={converting}
          >
            <Repeat2 />
            {t("crop_image.convert")}
          </button>
        )}

        {canSkipCrop && (
          <button onClick={onSkip} className="btn btn-outline rounded-3xl">
            <ImageOff />
            {t("crop_image.skip")}
          </button>
        )}

        <button
          onClick={onCrop}
          disabled={cropDisabled}
          className="btn btn-primary rounded-3xl"
        >
          <Scissors />
          {t("crop_image.crop")}
        </button>
      </div>

      <p className="text-xs italic text-center text-base-content/40 mt-1">
        {t("crop_image.error_report")}
      </p>
    </div>
  );
};

export default CropFooter;
