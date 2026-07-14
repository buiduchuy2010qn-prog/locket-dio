import "./styles.css";

const MusicOverlay = ({ postOverlay }) => {
  const icon = postOverlay?.icon || {};
  const payload = postOverlay?.payload || {};
  const text =
    postOverlay?.text ||
    postOverlay?.caption ||
    [payload.song_title || payload.song_name, payload.artist]
      .filter(Boolean)
      .join(" - ") ||
    "Nhạc";
  const cover =
    icon.data || payload.image_url || payload.image || "";
  const showSpotify =
    postOverlay?.platform === "spotify" ||
    Boolean(payload.spotify_url) ||
    Boolean(payload.isrc);

  return (
    <div className="flex w-auto items-center gap-2 py-2 px-4 rounded-4xl text-white font-semibold bg-white/50 backdrop-blur-2xl max-w-[85%] overflow-hidden">
      {cover ? (
        <img
          src={cover}
          alt="Cover"
          className="w-6 h-6 object-cover rounded-sm shrink-0 no-select no-save"
        />
      ) : null}

      <div className="relative overflow-hidden whitespace-nowrap flex-1">
        <div
          className="inline-block animate-marquee"
          style={{
            animationDuration:
              text.length < 30 ? "9s" : text.length < 60 ? "15s" : "17s",
          }}
        >
          <span className="mr-4">{text}</span>
          <span className="mr-4 absolute">{text}</span>
        </div>
      </div>
      {showSpotify && (
        <div className="flex items-center gap-2 shrink-0 no-select no-save">
          <div className="border-l border-white h-5"></div>
          <img
            src="/icons/spotify_icon.png"
            alt="Spotify Icon"
            className="w-6 h-6 object-contain"
          />
        </div>
      )}
    </div>
  );
};

export default MusicOverlay;
