import { useEffect, useRef, useState } from "react";

function resizeAppleCover(url, size = 64) {
  if (!url || typeof url !== "string") return "";
  return url.replace(/\/\d+x\d+bb(\.(jpg|png))?$/, `/${size}x${size}bb.jpg`);
}

function resolvePreviewSrc(payload) {
  if (!payload || typeof payload !== "object") return null;
  return (
    payload.preview_url ||
    payload.previewUrl ||
    payload.audio ||
    payload.preview ||
    null
  );
}

export function MusicPlayer({
  thumbnail,
  payload,
  isVisible = true,
}) {
  const audioRef = useRef(null);
  const [blocked, setBlocked] = useState(false);

  // 🎧 Media Session
  useEffect(() => {
    if (!("mediaSession" in navigator) || !isVisible) {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: payload?.song_title || payload?.song_name || payload?.name || "",
      artist: payload?.artist || "",
      album: payload?.album || "",
      artwork: [
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
        {
          src: resizeAppleCover(thumbnail, 512),
          sizes: "512x512",
          type: "image/jpeg",
        },
      ],
    });

    navigator.mediaSession.setActionHandler("play", () => {
      audioRef.current?.play().catch(() => {});
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
    });

    return () => {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [payload, thumbnail, isVisible]);

  // ▶️ Audio Logic — KHÔNG set crossOrigin (tránh fail khi CDN thiếu CORS)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!isVisible) {
      audio.pause();
      return;
    }

    const src = resolvePreviewSrc(payload);
    if (!src) {
      setBlocked(false);
      return;
    }

    // Bỏ crossOrigin — iTunes/Deezer vẫn play được nếu không taint canvas
    try {
      audio.removeAttribute("crossorigin");
    } catch {
      /* ignore */
    }
    audio.preload = "auto";
    // Clip loop within startTime/endTime when set
    const start = Number(payload?.startTime) || 0;
    const end = Number(payload?.endTime) || 0;
    const vol = Number(payload?.volume);
    audio.loop = !(end > start);
    audio.volume = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 1;
    audio.muted = false;

    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }

    const seekStart = () => {
      try {
        if (start > 0 && Number.isFinite(audio.currentTime)) {
          if (audio.currentTime < start || (end > start && audio.currentTime >= end)) {
            audio.currentTime = start;
          }
        }
      } catch {
        /* ignore */
      }
    };

    const onTimeUpdate = () => {
      if (end > start && audio.currentTime >= end) {
        try {
          audio.currentTime = start;
          if (!audio.paused) audio.play().catch(() => {});
        } catch {
          /* ignore */
        }
      }
    };

    const tryPlay = () => {
      seekStart();
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(() => setBlocked(false)).catch(() => {
          // Autoplay policy — user tap unlocks; never crash
          setBlocked(true);
        });
      }
    };

    const onCanPlay = () => tryPlay();
    const onError = () => {
      console.warn("[MusicPlayer] preview load error", src?.slice?.(0, 80));
      setBlocked(true);
    };

    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTimeUpdate);
    tryPlay();

    // Gesture unlock: lần chạm đầu trên document
    const unlock = () => {
      tryPlay();
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("click", unlock, true);
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("touchstart", unlock, true);
    document.addEventListener("click", unlock, true);

    return () => {
      audio.pause();
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("click", unlock, true);
    };
  }, [
    payload?.preview_url,
    payload?.previewUrl,
    payload?.audio,
    payload?.preview,
    payload?.startTime,
    payload?.endTime,
    payload?.volume,
    isVisible,
  ]);

  return (
    <>
      <audio
        ref={audioRef}
        className="hidden"
        playsInline
        preload="auto"
      />
      {/* hint nhỏ nếu autoplay bị chặn — tap bất kỳ để nghe */}
      {blocked && isVisible && resolvePreviewSrc(payload) ? (
        <span className="sr-only" aria-live="polite">
          Chạm màn hình để phát nhạc
        </span>
      ) : null}
    </>
  );
}
