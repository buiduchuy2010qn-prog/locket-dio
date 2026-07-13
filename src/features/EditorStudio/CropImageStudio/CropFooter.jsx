import { Repeat2, Scissors, X, ImageOff, Loader2 } from "lucide-react";
import ImageMetadata from "./ImageMetadata";
import { useTranslation } from "react-i18next";

const CropFooter = ({
  imageToCrop,
  needConvert,
  converting,
  cropDisabled,
  cropping,
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
    <div className="w-full border-t border-base-300 bg-base-200 shrink-0 p-4 shadow-lg z-10 relative rounded-t-3xl safe-pb">
      <h1 className="text-xl font-lovehouse text-left text-base-content">
        {t("crop_image.title")}
      </h1>

      <div className="my-1 space-y-1 text-xs text-base-content/80">
        <p>{t("crop_image.instruction_zoom")}</p>
        {needConvert ? (
          <p className="text-warning">{t("crop_image.instruction_convert")}</p>
        ) : (
          <p className="text-success/80">Kéo / phóng to để chọn khung vuông 1:1</p>
        )}
      </div>

      {imageToCrop && (
        <ImageMetadata
          fileName={fileName}
          fileType={fileType}
          fileExt={fileExt}
          fileSizeMB={fileSizeMB}
        />
      )}

      {cropError && (
        <p className="text-sm text-left text-error font-medium mt-2 break-words">
          {cropError}
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2 pt-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={converting || cropping}
          className="btn btn-outline btn-error rounded-3xl"
        >
          <X className="w-4 h-4" />
          {t("crop_image.cancel")}
        </button>

        <button
          type="button"
          onClick={onConvert}
          className="btn btn-secondary rounded-3xl"
          disabled={converting || cropping}
        >
          {converting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Repeat2 className="w-4 h-4" />
          )}
          {t("crop_image.convert")}
        </button>

        {canSkipCrop && (
          <button
            type="button"
            onClick={onSkip}
            disabled={converting || cropping}
            className="btn btn-outline rounded-3xl"
          >
            <ImageOff className="w-4 h-4" />
            {t("crop_image.skip")}
          </button>
        )}

        <button
          type="button"
          onClick={onCrop}
          disabled={cropDisabled}
          className="btn btn-primary rounded-3xl min-w-[7.5rem]"
        >
          {cropping || converting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Scissors className="w-4 h-4" />
          )}
          {cropping ? "Đang cắt…" : t("crop_image.crop")}
        </button>
      </div>

      <p className="text-xs italic text-center text-base-content/40 mt-2">
        {t("crop_image.error_report")}
      </p>
    </div>
  );
};

export default CropFooter;
