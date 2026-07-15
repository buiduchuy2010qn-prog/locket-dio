import "./styles.css";
import { MusicPlayer } from "@/components/Widgets/MusicPlayer";

/**
 * Pill nhạc trên moment — cover + tên + nút Play (web).
 * App Locket official phát qua Spotify/Apple; web phát preview iTunes.
 */
const MusicOverlay = ({ overlayData, momentId }) => {
  const music =
    overlayData?.payload ||
    overlayData?.music ||
    (overlayData?.isrc || overlayData?.song_title ? overlayData : {}) ||
    {};

  const text =
    overlayData?.text ||
    overlayData?.caption ||
    music.title ||
    [music.song_title || music.song_name || music.name, music.artist]
      .filter(Boolean)
      .join(" · ") ||
    music.song_title ||
    music.song_name ||
    "";
  const urlImage =
    overlayData?.icon?.data ||
    music.image_url ||
    music.image ||
    music.thumbnail_url ||
    "";

  if (!text && !urlImage && !music.isrc) return null;
  const displayText = text || "Nhạc";

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex w-auto items-center gap-2 py-2 pl-2.5 pr-2 rounded-4xl text-white font-semibold bg-white/50 backdrop-blur-2xl max-w-[90%] overflow-visible z-20 shadow-lg">
      {urlImage ? (
        <img
          src={urlImage}
          alt=""
          className="w-7 h-7 object-cover rounded-md shrink-0 no-select no-save"
          draggable={false}
        />
      ) : null}

      <div className="relative overflow-hidden whitespace-nowrap flex-1 min-w-0 max-w-[12rem] sm:max-w-[16rem]">
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

      {/* Nút Play rõ ràng — bắt buộc user gesture trên Chrome/mobile */}
      <MusicPlayer
        thumbnail={urlImage}
        payload={music}
        isVisible
        showButton
      />
    </div>
  );
};

export default MusicOverlay;
