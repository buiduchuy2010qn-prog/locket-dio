import { useTranslation } from "react-i18next";

const ImageMetadata = ({ fileName, fileType, fileExt, fileSizeMB }) => {
  const { t } = useTranslation("features");

  return (
    <div className="bg-base-300 p-2 rounded-lg w-fit mt-2 text-xs text-base-content/80 space-y-1">
      <p>📄 {t("crop_image.metadata.name")}: {fileName}</p>
      <p>📦 {t("crop_image.metadata.type")}: {fileType}</p>
      <p>🧩 {t("crop_image.metadata.extension")}: {fileExt}</p>
      <p>💾 {t("crop_image.metadata.size")}: {fileSizeMB} MB</p>
    </div>
  );
};

export default ImageMetadata;
