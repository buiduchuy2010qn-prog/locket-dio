import { X, Sparkles } from "lucide-react";
import * as services from "@/services";
import { useApp } from "@/context/AppContext.jsx";
import { useCallback, useContext, useState } from "react";
import { defaultPostOverlay } from "@/stores/usePost.js";
import UploadStatusIcon from "./UploadStatusIcon.jsx";
import { getMaxUploads } from "@/hooks/useFeature.js";
import {
  SonnerError,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";
import { enqueuePayload, getQueuePayloads } from "@/process/uploadQueue.js";
import { AuthContext } from "@/context/AuthLocket.jsx";

const MediaControls = () => {
  const { navigation, post, useloading, camera } = useApp();
  const { setIsFilterOpen } = navigation;
  const { sendLoading, uploadLoading, setUploadLoading } = useloading;
  const {
    preview,
    setPreview,
    selectedFile,
    setSelectedFile,
    isSizeMedia,
    setSizeMedia,
    recentPosts,
    setRecentPosts,
    postOverlay,
    setPostOverlay,
    audience,
    setAudience,
    selectedRecipients,
    setSelectedRecipients,
    maxImageSizeMB,
    maxVideoSizeMB,
    setuploadPayloads,
  } = post;
  const { setCameraActive } = camera;
  const { setStreak } = useContext(AuthContext);

  //Nhap hooks
  const { storage_limit_mb } = getMaxUploads();

  // State để quản lý hiệu ứng loading và success
  const [isSuccess, setIsSuccess] = useState(false);

  const handleDelete = useCallback(() => {
    // Dừng stream cũ nếu có
    if (camera.streamRef.current) {
      camera.streamRef.current.getTracks().forEach((track) => track.stop());
      camera.streamRef.current = null;
    }
    setSelectedFile(null);
    setPreview(null);
    setSizeMedia(null);
    setPostOverlay(defaultPostOverlay);
    setAudience("all");
    setCameraActive(true); // Giữ dòng này để trigger useEffect
    setIsSuccess(false); // Reset success state
  }, []);

  // Hàm submit được cải tiến
  const handleSubmit = async () => {
    if (!selectedFile) {
      SonnerWarning("Không có dữ liệu để tải lên.");
      return;
    }

    const { type: previewType } = preview || {};
    const isImage = previewType === "image";
    const isVideo = previewType === "video";
    const maxFileSize = isImage ? maxImageSizeMB : maxVideoSizeMB;

    if (isVideo && isSizeMedia < 0.2) {
      SonnerWarning("Video quá nhẹ hoặc không hợp lệ (dưới 0.2MB).");
      return;
    }
    // Size gate disabled (full unlock). Soft warn only if over limit.
    if (maxFileSize && isSizeMedia > maxFileSize) {
      SonnerWarning(
        `${isImage ? "Ảnh" : "Video"} khá nặng (${isSizeMedia}MB). Vẫn thử đăng...`
      );
    }

    try {
      // Bắt đầu loading
      setUploadLoading(true);
      setIsSuccess(false);

      // Tạo payload
      const payload = await services.createRequestPayloadV5(
        selectedFile,
        previewType,
        postOverlay,
        audience,
        selectedRecipients
      );

      if (!payload) {
        throw new Error("Không tạo được payload. Hủy tiến trình tải lên.");
      }

      // Lưu payload → background queue đăng (không hiện UI hàng đợi)
      await enqueuePayload(payload, setStreak);

      setUploadLoading(false);
      setIsSuccess(true);
      SonnerSuccess("Đang đăng...", "Ảnh sẽ tự hiện trong feed sau khi xong");

      const currentPayloads = await getQueuePayloads();
      setuploadPayloads(currentPayloads);
      setTimeout(() => {
        setIsSuccess(false);
        handleDelete();
      }, 1000);
    } catch (error) {
      setUploadLoading(false);
      setIsSuccess(false);

      const { formatApiError } = await import("@/utils/formatApiError");
      const errorMessage = formatApiError(error, "Lỗi không xác định");
      try {
        localStorage.setItem(
          "lastUploadError",
          JSON.stringify({
            at: new Date().toISOString(),
            phase: "createPayload",
            detail: errorMessage,
            status: error?.response?.status || null,
            data: error?.response?.data ?? null,
          })
        );
      } catch {
        /* ignore */
      }
      SonnerError("Tạo payload thất bại!", errorMessage);

      console.error("❌ Tạo payload thất bại:", error);
    }
  };

  return (
    <>
      <div className="flex gap-4 w-full max-w-md justify-evenly items-center">
        <button
          className="cursor-pointer"
          onClick={handleDelete}
          disabled={sendLoading || uploadLoading}
        >
          <X size={35} />
        </button>
        <button
          onClick={handleSubmit}
          className={`rounded-full w-22 h-22 duration-500 outline-base-300 backdrop-blur-4xl mx-2.5 text-center flex items-center justify-center disabled:opacity-50 transition-all ease-in-out ${
            isSuccess
              ? "bg-green-500/20"
              : uploadLoading
              ? "bg-blue-500/20"
              : "bg-base-300/50 hover:bg-base-300/70"
          }`}
          disabled={uploadLoading}
          style={{
            animation: isSuccess ? "success-pulse 1s ease-in-out" : "none",
          }}
        >
          <UploadStatusIcon loading={uploadLoading} success={isSuccess} />
        </button>
        <button
          className="cursor-pointer"
          onClick={() => {
            setIsFilterOpen(true);
          }}
          disabled={uploadLoading}
        >
          <Sparkles size={35} />
        </button>
      </div>
    </>
  );
};

export default MediaControls;
