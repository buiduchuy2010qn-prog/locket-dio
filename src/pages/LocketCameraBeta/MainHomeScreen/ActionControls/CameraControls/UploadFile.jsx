import React, { useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { ImageUp } from "lucide-react";
import { SonnerInfo } from "@/components/uikit/SonnerToast";
import { useMomentDraftStore, usePostStore } from "@/stores";
import { useTranslation } from "react-i18next";

const UploadFile = () => {
  const { t } = useTranslation("main");
  const { camera } = useApp();

  const resetMedia = usePostStore((s) => s.resetMedia);
  const setImageToCrop = usePostStore((s) => s.setImageToCrop);
  const setVideoToCrop = usePostStore((s) => s.setVideoToCrop);
  const applyNewMediaFile = useMomentDraftStore((s) => s.applyNewMediaFile);
  const hasDraft = useMomentDraftStore((s) => s.hasDraft);
  const showRestoreModal = useMomentDraftStore((s) => s.showRestoreModal);
  const openRestoreModal = useMomentDraftStore((s) => s.openRestoreModal);
  const selectedFile = usePostStore((s) => s.selectedFile);
  const preview = usePostStore((s) => s.preview);

  const { setCameraActive } = camera;
  const studioEmpty = !selectedFile && !preview?.data;
  const showDraftDot = hasDraft && studioEmpty && !showRestoreModal;

  const handleFileChange = useCallback(async (event) => {
    setCameraActive(false);

    const rawFile = event.target.files[0];
    if (!rawFile) return;
    const fileType = rawFile.type.startsWith("image/")
      ? "image"
      : rawFile.type.startsWith("video/")
        ? "video"
        : null;

    if (!fileType) {
      SonnerInfo(t("home.only_media_supported_short"));
      return;
    }

    const proceed = await useMomentDraftStore
      .getState()
      .requestReplaceOrContinue(rawFile);
    if (!proceed) {
      event.target.value = "";
      return;
    }

    resetMedia();

    if (fileType === "image") {
      setImageToCrop(rawFile);
      return;
    }
    if (fileType === "video") {
      setVideoToCrop(rawFile);
      return;
    }
    await applyNewMediaFile(rawFile);
  }, [applyNewMediaFile, resetMedia, setCameraActive, setImageToCrop, setVideoToCrop, t]);

  const handleLibraryClick = (e) => {
    // Long-press alternative: if draft exists, second intent via title — badge opens restore
    if (showDraftDot && e.detail === 2) {
      e.preventDefault();
      openRestoreModal();
    }
  };

  return (
    <>
      <input
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className="cameraSideBtn"
        aria-label={
          showDraftDot
            ? t("home.upload_library_with_draft", {
                defaultValue: "Thư viện · có bản nháp",
              })
            : t("home.upload_library", { defaultValue: "Thư viện" })
        }
        title={
          showDraftDot
            ? t("home.draft_hint", {
                defaultValue: "Chạm để chọn ảnh · Double-tap mở bản nháp",
              })
            : t("home.upload_library", { defaultValue: "Thư viện" })
        }
        onClick={handleLibraryClick}
      >
        <ImageUp size={24} strokeWidth={2} />
        {showDraftDot ? (
          <span
            className="cameraDraftDot"
            role="button"
            tabIndex={0}
            aria-label={t("home.open_draft", { defaultValue: "Mở bản nháp" })}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openRestoreModal();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                openRestoreModal();
              }
            }}
          />
        ) : null}
      </label>
    </>
  );
};
export default UploadFile;
