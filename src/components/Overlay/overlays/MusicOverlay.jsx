import { useCallback, useEffect, useMemo, useState } from "react";
import { Pause, Play, Loader2, Music2 } from "lucide-react";
import { resolvePlayablePreview, parseSongCaption } from "@/utils/musicPreview";
import {
  toggleMusicUrl,
  pauseMusic,
  subscribeMusicAudio,
  stopMusicIfKey,
} from "@/utils/musicAudio";
import "./styles.css";

/**
 * Pill nhạc trên moment — bấm CẢ pill để phát (web).
 * Resolve iTunes preview nếu thiếu preview_url trong payload Firestore.
 */
const MusicOverlay = ({ overlayData, momentId }) => {
  const music = useMemo(() => {
    const raw =
      overlayData?.payload ||
      overlayData?.music ||
      (overlayData?.isrc || overlayData?.song_title ? overlayData : {}) ||
      {};
    const text =
      overlayData?.text ||
      overlayData?.caption ||
      raw.title ||
      "";
    const parsed = parseSongCaption(text);
    const song_title =
      raw.song_title ||
      raw.song_name ||
      raw.name ||
      parsed.title ||
      "";
    const artist = raw.artist || parsed.artist || "";
    return {
      ...raw,
      song_title,
      song_name: raw.song_name || song_title,
      artist,
      text,
      caption: text,
      preview_url:
        raw.preview_url || raw.previewUrl || raw.audio || raw.audioUrl || null,
    };
  }, [overlayData]);

  const displayText =
    overlayData?.text ||
    overlayData?.caption ||
    music.title ||
    [music.song_title, music.artist].filter(Boolean).join(" · ") ||
    music.song_title ||
    "Nhạc";

  const urlImage =
    overlayData?.icon?.data ||
    music.image_url ||
    music.image ||
    music.thumbnail_url ||
    "";

  const trackKey = momentId || music.isrc || music.song_title || displayText;

  const [src, setSrc] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    return subscribeMusicAudio((s) => {
      const mine = s.key === trackKey;
      setPlaying(mine && s.playing);
      setLoading(mine && s.loading);
      if (mine && s.error) setErr(s.error);
    });
  }, [trackKey]);

  useEffect(() => {
    let cancelled = false;
    setErr("");
    resolvePlayablePreview(music).then((url) => {
      if (!cancelled) {
        setSrc(url || null);
        if (!url) setErr("Chạm để thử tải nhạc");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [music.preview_url, music.song_title, music.artist, music.isrc, music.text]);

  useEffect(() => {
    return () => stopMusicIfKey(trackKey);
  }, [trackKey]);

  const onToggle = useCallback(
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
        playSrc = await resolvePlayablePreview(music);
        if (playSrc) setSrc(playSrc);
      }
      if (!playSrc) {
        setLoading(false);
        setErr("Không tìm thấy file nghe thử");
        return;
      }
      const result = await toggleMusicUrl(playSrc, trackKey);
      setLoading(false);
      if (result === "error") setErr("Chạm lại để nghe");
    },
    [playing, src, music, trackKey],
  );

  if (!displayText && !urlImage && !music.isrc) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 flex w-auto items-center gap-2 py-2 pl-2.5 pr-2.5 rounded-4xl text-white font-semibold bg-black/55 backdrop-blur-xl max-w-[92%] overflow-visible z-30 shadow-lg border border-white/25 active:scale-[0.98] transition cursor-pointer"
      aria-label={playing ? "Tạm dừng nhạc" : "Phát nhạc"}
      title={err || (playing ? "Tạm dừng" : "Chạm để nghe nhạc")}
    >
      {urlImage ? (
        <img
          src={urlImage}
          alt=""
          className={`w-8 h-8 object-cover rounded-md shrink-0 no-select no-save ${playing ? "animate-pulse" : ""}`}
          draggable={false}
        />
      ) : (
        <span className="w-8 h-8 rounded-md bg-white/15 flex items-center justify-center shrink-0">
          <Music2 className="w-4 h-4" />
        </span>
      )}

      <div className="relative overflow-hidden whitespace-nowrap flex-1 min-w-0 max-w-[11rem] sm:max-w-[15rem] text-left">
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

      <span
        className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center border border-white/30 ${
          playing ? "bg-emerald-500/90" : "bg-white/20"
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : playing ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </span>
    </button>
  );
};

export default MusicOverlay;
