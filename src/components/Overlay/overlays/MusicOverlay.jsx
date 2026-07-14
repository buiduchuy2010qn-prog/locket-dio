import { useSelectedStore } from "@/stores";
import "./styles.css";
import { MusicPlayer } from "@/components/Widgets/MusicPlayer";

/**
 * Pill nhạc trên moment — giống app Locket:
 * cover + "Tên bài · Nghệ sĩ" + badge Spotify/Apple Music
 */
const MusicOverlay = ({ overlayData, momentId }) => {
  const selectedMomentId = useSelectedStore((s) => s.selectedMomentId);
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

  const platform = String(
    overlayData?.platform || music.platform || "",
  ).toLowerCase();
  const isApple =
    platform === "apple" ||
    platform === "apple_music" ||
    Boolean(music.apple_music_url || music.appleMusicUrl);
  const isSpotify =
    !isApple &&
    (platform === "spotify" ||
      Boolean(music.spotify_url) ||
      Boolean(music.isrc));

  if (!text && !urlImage && !music.isrc) return null;
  const displayText = text || "Nhạc";

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex w-auto items-center gap-2 py-2 px-4 rounded-4xl text-white font-semibold bg-white/50 backdrop-blur-2xl max-w-[85%] overflow-hidden z-20">
      {urlImage ? (
        <img
          src={urlImage}
          alt="Cover"
          className="w-6 h-6 object-cover rounded-sm shrink-0 no-select no-save"
        />
      ) : (
        <img
          src="/icons/music_icon.png"
          alt="Music"
          className="w-5 h-5 object-contain shrink-0 opacity-90 no-select no-save"
        />
      )}

      <div className="relative overflow-hidden whitespace-nowrap flex-1 min-w-0">
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
          <span className="mr-4 absolute">{displayText}</span>
        </div>
      </div>

      {(isSpotify || isApple) && (
        <div className="flex items-center gap-2 shrink-0 no-select no-save">
          <div className="border-l border-white/70 h-5" />
          {isApple ? (
            <span className="text-[11px] font-bold tracking-tight whitespace-nowrap text-white drop-shadow">
              🍎 Music
            </span>
          ) : (
            <img
              src="/icons/spotify_icon.png"
              alt="Spotify"
              className="w-6 h-6 object-contain"
            />
          )}
        </div>
      )}

      <MusicPlayer
        thumbnail={urlImage}
        payload={music}
        isVisible={
          !momentId || !selectedMomentId || selectedMomentId === momentId
        }
      />
    </div>
  );
};

export default MusicOverlay;
