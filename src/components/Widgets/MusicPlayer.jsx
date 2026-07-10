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
    audio.loop = true;
    audio.volume = 1;
    audio.muted = false;

    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }

    const tryPlay = () => {
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(() => setBlocked(false)).catch(() => {
          // Autoplay policy — user tap overlay sẽ play
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
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("click", unlock, true);
    };
  }, [
    payload?.preview_url,
    payload?.previewUrl,
    payload?.audio,
    payload?.preview,
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
