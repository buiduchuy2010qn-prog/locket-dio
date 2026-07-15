import { Music2 } from "lucide-react";
import "./styles.css";

/**
 * Pill nhạc trên moment — chỉ hiển thị (cover + tên).
 * Không play trên web; app Locket chính hãng tự phát.
 */
const MusicOverlay = ({ overlayData }) => {
  const music =
    overlayData?.payload ||
    overlayData?.music ||
    (overlayData?.isrc || overlayData?.song_title ? overlayData : {}) ||
    {};

  const displayText =
    overlayData?.text ||
    overlayData?.caption ||
    music.title ||
    [music.song_title || music.song_name || music.name, music.artist]
      .filter(Boolean)
      .join(" · ") ||
    music.song_title ||
    music.song_name ||
    "Nhạc";

  const urlImage =
    overlayData?.icon?.data ||
    music.image_url ||
    music.image ||
    music.thumbnail_url ||
    "";

  if (!displayText && !urlImage && !music.isrc) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex w-auto items-center gap-2 py-2 pl-2.5 pr-3 rounded-4xl text-white font-semibold bg-black/55 backdrop-blur-xl max-w-[92%] overflow-hidden z-20 shadow-lg border border-white/20 pointer-events-none">
      {urlImage ? (
        <img
          src={urlImage}
          alt=""
          className="w-7 h-7 object-cover rounded-md shrink-0 no-select no-save"
          draggable={false}
        />
      ) : (
        <span className="w-7 h-7 rounded-md bg-white/15 flex items-center justify-center shrink-0">
          <Music2 className="w-3.5 h-3.5" />
        </span>
      )}

      <div className="relative overflow-hidden whitespace-nowrap flex-1 min-w-0 max-w-[12rem] sm:max-w-[16rem] text-left">
        <div
          className="inline-block animate-marquee"
          style={{
            animationDuration:
              displayText.length < 30
                ? "9s"
                : displayText.length < 60
                  ? "15s"
                  : "17s",
          }}
        >
          <span className="mr-4">{displayText}</span>
          <span className="mr-4 absolute top-0 left-0">{displayText}</span>
        </div>
      </div>
    </div>
  );
};

export default MusicOverlay;
