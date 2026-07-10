import React, { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import LoadingOverlay from "@/components/ui/Loading/LineSpinner";
import { useSelectedStore, useUploadQueueStore } from "@/stores";
import { useTranslation } from "react-i18next";

const UploadingQueue = () => {
  const { t } = useTranslation("main");
  const [loadedItems, setLoadedItems] = useState([]);

  const selectedQueue = useSelectedStore((s) => s.selectedQueue);
  const setSelectedQueue = useSelectedStore((s) => s.setSelectedQueue);

  const selectedQueueId = useSelectedStore((s) => s.selectedQueueId);
  const setSelectedQueueId = useSelectedStore((s) => s.setSelectedQueueId);

  const uploadItems = useUploadQueueStore((s) => s.uploadItems);
  const handleLoaded = (id) => {
    setLoadedItems((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  if (uploadItems.length === 0)
    return (
      <div className="flex justify-center items-center w-full">
        <p className="text-sm">i love Huy Locket</p>
      </div>
    );

  return (
    <>
      <h1 className="text-base font-semibold">{t("bottom.uploading_media_title")}</h1>
      <p className="text-sm italic">
        {t("bottom.uploading_media_note")}
      </p>
      <p>
        {t("bottom.uploading_media_retry_note")}
      </p>
      <Link to={"/incidents"} className="text-sm underline cursor-pointer">
        {t("bottom.incident_ref_page")}
      </Link>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-2">
        {uploadItems.map((item, index) => {
          const media = item.mediaInfo;
          const status = item.status || "uploading";
          const isVideo = media?.type === "video";
          const url = media?.publicUrl || media?.publicURL || media?.url;

          return (
            <div
              key={index}
              className="relative aspect-square overflow-hidden rounded-xl bg-gray-100 shadow group"
              onClick={() => {
                setSelectedQueue(index);
                setSelectedQueueId(item.id);
              }}
            >
              {isVideo ? (
                <>
                  <video
                    src={url}
                    className="object-cover w-full h-full"
                    autoPlay
                    loop
                    muted
                    playsInline
                    onLoad={() => handleLoaded(item.id)}
                  />
                  <div className="absolute top-2 right-2 bg-black/50 z-30 p-1 rounded-full">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </>
              ) : (
                <img
                  src={url}
                  alt="Media"
                  className="object-cover w-full h-full"
                  onLoad={() => handleLoaded(item.id)}
                />
              )}

              {/* Overlay theo trạng thái */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                {status === "uploading" && <LoadingOverlay color="white" />}
                {status === "done" && (
                  <Check className="text-green-400 w-6 h-6 animate-bounce" />
                )}
                {status === "failed" && (
                  <div className="flex flex-col items-center font-semibold text-error">
                    <RotateCcw strokeWidth={1.5} className={`w-12 h-12 `} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <hr className="my-3" />
    </>
  );
};

export default UploadingQueue;
