import { useCallback, useEffect, useId, useState } from "react";
import { Pause, Play, Loader2 } from "lucide-react";
import { resolvePlayablePreview } from "@/utils/musicPreview";
import {
  toggleMusicUrl,
  pauseMusic,
  subscribeMusicAudio,
  stopMusicIfKey,
} from "@/utils/musicAudio";

/**
 * Nút phát nhạc web — dùng global Audio, bắt buộc user gesture.
 * props.payload: { song_title, artist, preview_url, text, ... }
 */
export function MusicPlayer({
  payload,
  isVisible = true,
  showButton = true,
  className = "",
  /** id ổn định theo moment để pause khi đổi slide */
  trackKey,
  /** callback khi parent muốn biết đang phát */
  onPlayingChange,
}) {
  const reactId = useId();
  const key = trackKey || reactId;
  const [src, setSrc] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Sync global audio state
  useEffect(() => {
    return subscribeMusicAudio((s) => {
      const mine = s.key === key;
      setPlaying(mine && s.playing);
      setLoading(mine && s.loading);
      if (mine && s.error) setErr(s.error);
      onPlayingChange?.(mine && s.playing);
    });
  }, [key, onPlayingChange]);

  // Resolve preview URL
  useEffect(() => {
    let cancelled = false;
    if (!payload) {
      setSrc(null);
      return;
    }
    setResolving(true);
    setErr("");
    resolvePlayablePreview(payload)
      .then((url) => {
        if (!cancelled) {
          setSrc(url || null);
          if (!url) setErr("Không có file nghe thử");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
          setErr("Lỗi tải nhạc");
        }
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    payload?.preview_url,
    payload?.previewUrl,
    payload?.audio,
    payload?.audioUrl,
    payload?.song_title,
    payload?.song_name,
    payload?.artist,
    payload?.isrc,
    payload?.text,
    payload?.caption,
    payload?.title,
  ]);

  // Pause khi ẩn (đổi moment)
  useEffect(() => {
    if (!isVisible) {
      stopMusicIfKey(key);
    }
  }, [isVisible, key]);

  // Unmount → dừng nếu đang phát bài này
  useEffect(() => {
    return () => stopMusicIfKey(key);
  }, [key]);

  const toggle = useCallback(
    async (e) => {
      e?.stopPropagation?.();
      e?.preventDefault?.();

      if (playing) {
        pauseMusic();
        return;
      }

      setLoading(true);
      setErr("");

      let playSrc = src;
      if (!playSrc) {
        playSrc = await resolvePlayablePreview(payload || {});
        if (playSrc) setSrc(playSrc);
      }

      if (!playSrc) {
        setLoading(false);
        setErr("Không có file nghe thử");
        return;
      }

      const result = await toggleMusicUrl(playSrc, key);
      setLoading(false);
      if (result === "error") {
        setErr("Chạm lại để nghe");
      } else {
        setErr("");
      }
    },
    [src, payload, key, playing],
  );

  if (!isVisible) return null;

  if (!showButton) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="absolute inset-0 z-30 cursor-pointer"
        aria-label={playing ? "Tạm dừng" : "Phát nhạc"}
      />
    );
  }

  const busy = resolving || loading;

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ||
        "shrink-0 w-9 h-9 rounded-full bg-black/70 text-white flex items-center justify-center active:scale-95 transition shadow-md border border-white/30 hover:bg-black/85"
      }
      aria-label={playing ? "Tạm dừng" : "Phát nhạc"}
      title={err || (playing ? "Tạm dừng" : "Phát nhạc")}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : playing ? (
        <Pause className="w-4 h-4 fill-current" />
      ) : (
        <Play className="w-4 h-4 fill-current ml-0.5" />
      )}
    </button>
  );
}

