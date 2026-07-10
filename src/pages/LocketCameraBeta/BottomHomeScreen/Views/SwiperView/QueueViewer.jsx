import { useEffect, useState } from "react";
import { Check, RotateCcw, TriangleAlert, X } from "lucide-react";
import LoadingOverlay from "@/components/ui/Loading/LineSpinner";
import { useSelectedStore, useUploadQueueStore } from "@/stores";
import { SonnerWarning } from "@/components/ui/SonnerToast";
import { OverlayRenderer } from "@/components/Overlay";
import { useTranslation } from "react-i18next";

const QueueViewer = () => {
  const { t } = useTranslation("main");
  const retryUploadItem = useUploadQueueStore((s) => s.retryUploadItem);

  const selectedQueue = useSelectedStore((s) => s.selectedQueue);
  const setSelectedQueue = useSelectedStore((s) => s.setSelectedQueue);

  const selectedQueueId = useSelectedStore((s) => s.selectedQueueId);
  const setSelectedQueueId = useSelectedStore((s) => s.setSelectedQueueId);

  const queueInfo = useUploadQueueStore((s) =>
    s.uploadItems.find((i) => i.id === selectedQueueId),
  );

  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [mediaFailed, setMediaFailed] = useState(false);
  // Mở hiệu ứng khi có selectedQueue
  const removeUploadItemById = useUploadQueueStore((s) => s.removeUploadItemById);

  useEffect(() => {
    if (selectedQueue !== null) {
      setIsVisible(true);
      setIsMediaLoading(true);
      setMediaFailed(false);
    }
  }, [selectedQueue]);

  const handleClose = () => {
    setIsAnimating(true);
    setIsVisible(false);
    setTimeout(() => {
      setSelectedQueue(null);
      setSelectedQueueId(null);
      setIsAnimating(false);
    }, 300);
  };

  // Item biến mất (auto cleanup) → đóng modal
  useEffect(() => {
    if (selectedQueueId && !queueInfo) {
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQueueId, queueInfo]);

  // Media URL chết → xóa item + đóng
  useEffect(() => {
    if (!mediaFailed || !queueInfo?.id) return;
    const t = setTimeout(() => {
      removeUploadItemById(queueInfo.id);
      handleClose();
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaFailed, queueInfo?.id]);

  // Khóa cuộn khi mở modal
  useEffect(() => {
    const shouldLock = selectedQueue !== null || isAnimating;
    if (shouldLock) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }

    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [selectedQueue, isAnimating]);

  const handleRetry = async () => {
    if (mediaFailed) {
      SonnerWarning(t("bottom.media_not_exist_error"));
      return;
    }
    if (!queueInfo?.id) return;

    try {
      retryUploadItem(queueInfo.id);
      handleClose();
    } catch (err) {
      console.error("❌ Retry failed:", err);
    }
  };

  if (!queueInfo && !isAnimating) return null;

  const mediaType = queueInfo?.mediaInfo?.type;
  const mediaUrl =
    queueInfo?.mediaInfo?.publicUrl ||
    queueInfo?.mediaInfo?.publicURL ||
    queueInfo?.mediaInfo?.url;

  const optionsData = queueInfo?.optionsData || {};

  const caption = queueInfo?.optionsData?.text || queueInfo?.text || "";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between items-center transition-all duration-300 ease-in-out bg-base-100 ${
        isVisible && !isAnimating
          ? "opacity-100"
          : "opacity-0 pointer-events-none"
      }`}
      tabIndex={0}
    >
      <div className="flex-1 flex flex-col justify-center items-center w-full gap-2 pb-25">
        <div
          className={`relative w-full max-w-md aspect-square bg-base-200 rounded-[64px] overflow-hidden transition-all duration-300 ease-in-out ${
            isVisible && !isAnimating
              ? "opacity-100 scale-100"
              : "opacity-0 scale-90 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Nút đóng */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-50 p-2 bg-black/40 rounded-full hover:bg-black/60"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Nội dung media */}
          <div className="h-full w-full flex items-center justify-center relative">
            {mediaFailed ? (
              <div className="h-full w-full rounded-2xl flex flex-col items-center justify-center bg-base-200 select-none p-8 gap-3">
                <span className="text-5xl font-semibold">{":("}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-error btn-outline rounded-full"
                  onClick={async () => {
                    if (queueInfo?.id) await removeUploadItemById(queueInfo.id);
                    handleClose();
                  }}
                >
                  Xóa
                </button>
              </div>
            ) : mediaType === "video" ? (
              <video
                src={mediaUrl}
                className="max-h-full max-w-full object-contain rounded-2xl"
                autoPlay
                muted
                loop
                playsInline
                onError={() => setMediaFailed(true)}
              />
            ) : (
              <img
                src={mediaUrl}
                alt={caption}
                className="max-h-full max-w-full object-contain rounded-2xl"
                onError={() => setMediaFailed(true)}
              />
            )}

            {/* Status Icon — gọn, không CODE/MSG dài */}
            {queueInfo?.status && !mediaFailed && (
              <div className="absolute w-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 flex justify-center">
                {(queueInfo?.status === "uploading" ||
                  queueInfo?.status === "queued") && (
                  <LoadingOverlay color="white" />
                )}
                {queueInfo?.status === "done" && (
                  <Check className="text-green-400 w-8 h-8 animate-bounce" />
                )}
                {queueInfo?.status === "failed" && (
                  <TriangleAlert
                    strokeWidth={1.5}
                    className="w-14 h-14 text-error"
                  />
                )}
              </div>
            )}

            {/* Caption nếu có */}
            {optionsData && (
              <OverlayRenderer overlayData={optionsData} />
            )}
          </div>
        </div>
        <div className="flex justify-center z-30">
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 px-6 py-3 rounded-2xl font-semibold text-error"
          >
            <RotateCcw strokeWidth={2} className="w-10 h-10" />
            {t("bottom.retry")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QueueViewer;
