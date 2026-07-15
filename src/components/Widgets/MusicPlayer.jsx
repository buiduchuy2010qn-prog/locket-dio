import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";
import { resolvePlayablePreview } from "@/utils/musicPreview";

function resizeAppleCover(url, size = 64) {
  if (!url || typeof url !== "string") return "";
  return url.replace(/\/\d+x\d+bb(\.(jpg|png))?$/, `/${size}x${size}bb.jpg`);
}

/**
 * Web music player — luôn có nút Play (user gesture), loop preview ~30s.
 * Tự resolve iTunes preview nếu thiếu / link Deezer hết hạn.
 */
export function MusicPlayer({
  thumbnail,
  payload,
  isVisible = true,
  /** hiển thị nút play trên pill */
  showButton = true,
  className = "",
}) {
  const audioRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Resolve preview URL (iTunes fallback)
  useEffect(() => {
    let cancelled = false;
    setErr("");
    if (!payload) {
      setSrc(null);
      return;
    }
    setLoading(true);
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
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    payload?.preview_url,
    payload?.previewUrl,
    payload?.audio,
    payload?.song_title,
    payload?.song_name,
    payload?.artist,
    payload?.isrc,
  ]);

  // Media session
  useEffect(() => {
    if (!("mediaSession" in navigator) || !isVisible) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: payload?.song_title || payload?.song_name || payload?.name || "Nhạc",
      artist: payload?.artist || "",
      album: payload?.album || "",
      artwork: thumbnail
        ? [
            {
              src: resizeAppleCover(thumbnail, 96),
              sizes: "96x96",
              type: "image/jpeg",
            },
            {
              src: resizeAppleCover(thumbnail, 256),
              sizes: "256x256",
              type: "image/jpeg",
            },
          ]
        : [],
    });
    return () => {
      navigator.mediaSession.metadata = null;
    };
  }, [payload, thumbnail, isVisible]);

  // Wire audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!isVisible) {
      audio.pause();
      setPlaying(false);
      return;
    }

    if (!src) return;

    try {
      audio.removeAttribute("crossorigin");
    } catch {
      /* ignore */
    }
    audio.loop = true;
    audio.volume = 1;
    audio.muted = false;
    audio.preload = "auto";

    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      try {
        audio.currentTime = 0;
        audio.play().catch(() => setPlaying(false));
      } catch {
        setPlaying(false);
      }
    };
    const onError = () => {
      setErr("Không phát được — chạm Play thử lại");
      setPlaying(false);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [src, isVisible]);

  const toggle = useCallback(
    async (e) => {
      e?.stopPropagation?.();
      e?.preventDefault?.();
      const audio = audioRef.current;
      if (!audio) return;

      let playSrc = src;
      if (!playSrc) {
        setLoading(true);
        playSrc = await resolvePlayablePreview(payload || {});
        setLoading(false);
        if (!playSrc) {
          setErr("Không có file nghe thử");
          return;
        }
        setSrc(playSrc);
        audio.src = playSrc;
        audio.load();
      }

      if (!audio.paused) {
        audio.pause();
        setPlaying(false);
        return;
      }

      try {
        audio.loop = true;
        audio.currentTime = 0;
        await audio.play();
        setPlaying(true);
        setErr("");
      } catch (ex) {
        console.warn("[MusicPlayer] play blocked/failed", ex?.message);
        setErr("Chạm Play để nghe");
        setPlaying(false);
      }
    },
    [src, payload],
  );

  if (!isVisible) {
    return <audio ref={audioRef} className="hidden" playsInline preload="none" />;
  }

  return (
    <>
      <audio ref={audioRef} className="hidden" playsInline preload="auto" loop />
      {showButton ? (
        <button
          type="button"
          onClick={toggle}
          className={
            className ||
            "shrink-0 w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center active:scale-95 transition shadow-md border border-white/20"
          }
          aria-label={playing ? "Tạm dừng" : "Phát nhạc"}
          title={err || (playing ? "Tạm dừng" : "Phát nhạc")}
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : playing ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
      ) : null}
      {err && showButton ? (
        <span className="sr-only" aria-live="polite">
          {err}
        </span>
      ) : null}
      {!showButton && src ? (
        <button
          type="button"
          onClick={toggle}
          className="absolute inset-0 z-30 cursor-pointer"
          aria-label="Phát / dừng nhạc"
        />
      ) : null}
      {!showButton && playing ? (
        <Volume2 className="w-3 h-3 opacity-70 absolute -right-1 -top-1" />
      ) : null}
    </>
  );
}
