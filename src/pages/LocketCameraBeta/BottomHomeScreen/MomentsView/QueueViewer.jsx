import { useContext, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Check, RotateCcw, X } from "lucide-react";
import LoadingOverlay from "@/components/ui/Loading/LineSpinner";
import { enRetryPayload, getQueuePayloads } from "@/process/uploadQueue";
import { AuthContext } from "@/context/AuthLocket";

const QueueViewer = () => {
  const { setStreak } = useContext(AuthContext);
  const { post } = useApp();
  const {
    uploadPayloads,
    selectedQueue,
    setSelectedQueue,
    setuploadPayloads,
    setRecentPosts,
  } = post;
  const [queueInfo, setQueueInfo] = useState(uploadPayloads[selectedQueue]);

  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(true);
  const [retryingIndex, setRetryingIndex] = useState(null);

  // Mở hiệu ứng khi có selectedQueue
  useEffect(() => {
    if (selectedQueue !== null) {
      setIsVisible(true);
      setIsMediaLoading(true); // reset loading khi chuyển queue
    }
  }, [selectedQueue]);

  const handleClose = () => {
    setIsAnimating(true);
    setIsVisible(false);
    setTimeout(() => {
      setSelectedQueue(null);
      setIsAnimating(false);
    }, 300);
  };

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
    const retryPayload = uploadPayloads[selectedQueue];
    setRetryingIndex(selectedQueue);

    if (!retryPayload) {
      console.warn("⚠️ Không tìm thấy payload để retry");
      setRetryingIndex(null);
      return;
    }

    try {
      // Tăng số lần thử và reset errorMessage
      const updatedPayload = {
        ...retryPayload,
        errorMessage: null,
        retryCount: (retryPayload.retryCount || 0) + 1,
      };

      // Đưa payload vào queue để consumer xử lý
      await enRetryPayload(updatedPayload, setStreak);

      // Cập nhật state UI
      const currentPayloads = await getQueuePayloads();
      setuploadPayloads(currentPayloads);

      const currentQueueInfo = currentPayloads.find(
        (p) => p.id === updatedPayload.id
      );
      setQueueInfo(currentQueueInfo);
    } catch (error) {
      console.error("❌ Upload thất bại:", error);
    } finally {
      setRetryingIndex(null);
    }
  };

  if (!queueInfo && !isAnimating) return null;

  const mediaType = queueInfo?.mediaInfo?.type;
  const mediaUrl = queueInfo?.mediaInfo?.url;
  const caption = queueInfo?.caption || "";
  const icon = queueInfo?.options?.icon || "";
  const colorTop = queueInfo?.options?.color_top || "#00000088";
  const colorBottom = queueInfo?.options?.color_bottom || "#000000cc";
  const textColor = queueInfo?.options?.text_color || "#ffffff";

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between items-center transition-all duration-300 ease-in-out bg-gradient-to-b from-pink-100 via-pink-50 to-pink-200 h-[100dvh] ${
        isVisible && !isAnimating
          ? "opacity-100"
          : "opacity-0 pointer-events-none"
      }`}
      // onClick={handleClose}
      tabIndex={0}
    >
      <div className="flex-1 flex flex-col justify-center items-center w-full gap-2 px-2 pb-[max(5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div
          className={`relative w-full max-w-[min(100%,520px)] aspect-square max-h-[min(92vw,calc(100dvh-11rem))] bg-black/10 rounded-[28px] sm:rounded-[40px] overflow-hidden shadow-xl shadow-pink-300/40 ring-1 ring-white/40 transition-all duration-300 ease-in-out ${
            isVisible && !isAnimating
              ? "opacity-100 scale-100"
              : "opacity-0 scale-90 pointer-events-none"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Nút đóng */}
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 z-50 p-2 bg-black/45 rounded-full hover:bg-black/60"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Nội dung media full khung */}
          <div className="h-full w-full flex items-center justify-center relative">
            {mediaType === "video" ? (
              <video
                src={mediaUrl}
                className="w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                //   onLoadedData={() => setIsMediaLoading(false)}
              />
            ) : (
              <img
                src={mediaUrl}
                alt={caption}
                className="w-full h-full object-cover"
                //   onLoad={() => setIsMediaLoading(false)}
              />
            )}
            {/* Status Icon */}
            {queueInfo?.status && (
              <>
                <div className="absolute inset-0 backdrop-blur-[2px] bg-black/40 flex items-center justify-center z-10"></div>

                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                  {queueInfo?.status === "processing" && (
                    <LoadingOverlay color="white" />
                  )}
                  {queueInfo?.status === "done" && (
                    <Check className="text-green-400 w-6 h-6 animate-bounce" />
                  )}
                  {queueInfo?.status === "failed" && (
                    <div
                      className="flex flex-col items-center justify-center text-error cursor-pointer"
                      onClick={handleRetry}
                    >
                      <RotateCcw
                        strokeWidth={1.5}
                        className="w-16 h-16 transition-transform duration-700"
                      />

                      {queueInfo?.errorMessage && (
                        <p className="text-xs text-center mt-2 text-white bg-black/50 px-2 py-1 rounded">
                          {queueInfo.errorMessage} - Lần thử lại:{" "}
                          {queueInfo?.retryCount}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            {/* Caption nếu có */}
            {caption && (
              <div
                className="absolute bottom-4 w-fit backdrop-blur-sm rounded-2xl px-3 py-2"
                style={{
                  background: `linear-gradient(to bottom, ${colorTop}, ${colorBottom})`,
                }}
              >
                <p className="text-sm font-medium" style={{ color: textColor }}>
                  {icon} {caption}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QueueViewer;
