/**
 * Camera studio — trước đây có nút play preview.
 * User yêu cầu bỏ play trên web; chỉ hiển thị tên bài đã gắn.
 */
export function MusicPlayer({ music }) {
  if (!music) return null;
  const title =
    music.song_title || music.song_name || music.name || music.title || "";
  if (!title) return null;

  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md pointer-events-none max-w-[85%]">
      <span className="text-white text-xs truncate font-medium">{title}</span>
    </div>
  );
}
