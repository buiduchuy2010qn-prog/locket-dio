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

  const setMediaFromFile = usePostStore((s) => s.setMediaFromFile);
  const applyNewMediaFile = useMomentDraftStore((s) => s.applyNewMediaFile);

  const { cameraActive, setCameraActive } = camera;

  //Handle tải file
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

    // Gate replace-draft before wiping studio
    const proceed = await useMomentDraftStore
      .getState()
      .requestReplaceOrContinue(rawFile);
    if (!proceed) {
      // Prompt open — do not reset yet
      event.target.value = "";
      return;
    }

    resetMedia();

    if (fileType === "image") {
      setImageToCrop(rawFile);
      // Crop flow will setMediaFromFile later → autosave via store subscribe
      return;
    }
    if (fileType === "video") {
      setVideoToCrop(rawFile);
      return;
    }
    await applyNewMediaFile(rawFile);
  }, []);

  return (
    <>
      <input
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="cursor-pointer active:scale-95">
        <ImageUp size={35} />
      </label>
    </>
  );
};
export default UploadFile;
