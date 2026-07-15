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

/** Deezer signed / scdn hay hết hạn giữa chừng — iTunes ổn hơn */
function isEphemeralPreview(url = "") {
  return /dzcdn\.net|hdnea=|cdnt-preview|p\.scdn\.co/i.test(String(url || ""));
}

export function MusicPlayer({
  thumbnail,
  payload,
  isVisible = true,
}) {
  const audioRef = useRef(null);
  const [blocked, setBlocked] = useState(false);
  const [hint, setHint] = useState(false);

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

  // ▶️ Audio — loop liên tục (preview ~30s lặp lại, không im sau 1 vòng)
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
      setHint(false);
      return;
    }

    try {
      audio.removeAttribute("crossorigin");
    } catch {
      /* ignore */
    }

    const start = Math.max(0, Number(payload?.startTime) || 0);
    let end = Number(payload?.endTime) || 0;
    // Clip editor hay set end=30; nếu >= độ dài file thật → coi như full + loop
    const vol = Number(payload?.volume);
    audio.volume = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : 1;
    audio.muted = false;
    audio.preload = "auto";
    // Luôn loop trên web — user muốn nghe liên tục khi xem feed
    audio.loop = true;

    if (audio.src !== src) {
      audio.src = src;
      audio.load();
    }

    const restartClip = () => {
      try {
        const d = Number(audio.duration);
        // endTime vô nghĩa / dài hơn file → full loop (audio.loop=true)
        if (!Number.isFinite(end) || end <= start || (d > 0 && end >= d - 0.15)) {
          audio.currentTime = 0;
          return;
        }
        audio.currentTime = start;
      } catch {
        /* ignore */
      }
    };

    const tryPlay = () => {
      restartClip();
      const p = audio.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          setBlocked(false);
          setHint(false);
        }).catch(() => {
          setBlocked(true);
          setHint(true);
        });
      }
    };

    const onTimeUpdate = () => {
      try {
        const d = Number(audio.duration);
        // Chỉ cắt đoạn khi end rõ ràng và ngắn hơn file (clip editor)
        if (
          end > start &&
          Number.isFinite(d) &&
          end < d - 0.2 &&
          audio.currentTime >= end - 0.05
        ) {
          audio.currentTime = start;
          if (!audio.paused) audio.play().catch(() => {});
        }
      } catch {
        /* ignore */
      }
    };

    // Quan trọng: khi file preview kết thúc, loop lại (tránh im sau ~30s)
    const onEnded = () => {
      try {
        restartClip();
        audio.play().catch(() => setHint(true));
      } catch {
        setHint(true);
      }
    };

    const onCanPlay = () => tryPlay();
    const onError = () => {
      console.warn(
        "[MusicPlayer] preview error",
        isEphemeralPreview(src) ? "(ephemeral URL?)" : "",
        src?.slice?.(0, 80),
      );
      setBlocked(true);
      setHint(true);
    };

    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    tryPlay();

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
      audio.removeEventListener("ended", onEnded);
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
        loop
      />
      {hint && isVisible && resolvePreviewSrc(payload) ? (
        <button
          type="button"
          className="absolute -top-8 left-1/2 -translate-x-1/2 z-30 text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-white whitespace-nowrap"
          onClick={(e) => {
            e.stopPropagation();
            const a = audioRef.current;
            if (!a) return;
            a.play()
              .then(() => setHint(false))
              .catch(() => {});
          }}
        >
          🔊 Chạm để nghe lại
        </button>
      ) : null}
      {blocked && isVisible && resolvePreviewSrc(payload) && !hint ? (
        <span className="sr-only" aria-live="polite">
          Chạm màn hình để phát nhạc
        </span>
      ) : null}
    </>
  );
}
