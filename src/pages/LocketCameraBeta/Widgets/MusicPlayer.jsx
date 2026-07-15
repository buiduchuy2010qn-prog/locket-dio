import { MusicPlayer as SharedMusicPlayer } from "@/components/Widgets/MusicPlayer";

/**
 * Camera studio — preview nhạc khi đã gắn caption music.
 * API cũ: <MusicPlayer music={payload} />
 */
export function MusicPlayer({ music }) {
  if (!music) return null;
  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md">
      <span className="text-white text-xs max-w-[10rem] truncate font-medium">
        {music.song_title || music.song_name || music.name || "Nhạc"}
      </span>
      <SharedMusicPlayer
        payload={music}
        thumbnail={music.image_url || music.image}
        isVisible
        showButton
      />
    </div>
  );
}
