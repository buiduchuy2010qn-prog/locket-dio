import LoadingRing from "@/components/ui/Loading/ring";
import { X } from "lucide-react";
import { useState } from "react";
import CaptionOverlay from "./CaptionOverlay";
import UserInfo from "../Layout/UserInfoView";

/**
 * Slide moment full màn hình mobile (dvh), ảnh gần full khung.
 */
const MomentSlide = ({ moment, me, handleClose }) => {
  const [isMediaLoading, setIsMediaLoading] = useState(true);

  const mediaSrc =
    moment?.thumbnailUrl ||
    moment?.thumbnail_url ||
    moment?.image_url ||
    moment?.imageUrl ||
    "";
  const videoSrc = moment?.videoUrl || moment?.video_url || "";

  return (
    <div className="flex w-full h-full min-h-0 flex-col justify-center items-center px-2 sm:px-3">
      <div
        className="relative flex flex-col items-center w-full h-full max-h-full gap-2 sm:gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute flex justify-center items-center top-2 right-2 sm:top-3 sm:right-3 z-50 p-2 bg-black/45 rounded-full hover:bg-black/60 active:scale-95"
          aria-label="Đóng"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </button>

        {/* Khung media: full width mobile, max theo chiều cao còn lại */}
        <div
          className="
            relative w-full flex-1 min-h-0
            max-h-[min(92vw,calc(100dvh-11rem))]
            aspect-square
            max-w-[min(100%,520px)]
            mx-auto
            flex items-center justify-center
            bg-black/10
            rounded-[28px] sm:rounded-[40px] md:rounded-[48px]
            overflow-hidden
            shadow-xl shadow-pink-300/40
            ring-1 ring-white/40
          "
        >
          {isMediaLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-pink-200/40 z-10">
              <LoadingRing color="orange" />
            </div>
          )}

          {videoSrc ? (
            <video
              src={videoSrc}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              onLoadedData={() => setIsMediaLoading(false)}
            />
          ) : (
            <img
              src={mediaSrc}
              alt={moment?.caption || "Moment"}
              className="w-full h-full object-cover"
              onLoad={() => setIsMediaLoading(false)}
              onError={() => setIsMediaLoading(false)}
            />
          )}

          {moment?.caption && <CaptionOverlay currentMoment={moment} />}
        </div>

        <div className="shrink-0 w-full max-w-[min(100%,520px)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <UserInfo user={moment?.user} me={me} date={moment?.date} />
        </div>
      </div>
    </div>
  );
};

export default MomentSlide;
