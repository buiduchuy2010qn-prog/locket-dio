import clsx from "clsx";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  Loader2,
  Music2,
  Search,
  Play,
  Pause,
  X,
} from "lucide-react";
import { searchMusicByQuery } from "@/services/ExtensionsServices/MusicServices";
import {
  listMusicTracks,
  searchMusicLibrary,
  uploadMusicTrack,
} from "@/services/ExtensionsServices/MusicLibraryServices";
import { SonnerError, SonnerInfo, SonnerSuccess } from "@/components/ui/SonnerToast";

const CLIP_OPTIONS = [30, 45, 60];

function formatSec(sec = 0) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatMs(ms = 0) {
  return formatSec(Number(ms) / 1000);
}

function trackSrc(track) {
  return (
    track?.preview_url ||
    track?.audioUrl ||
    track?.audio_url ||
    track?.audio ||
    ""
  );
}

function metaDurationSec(track) {
  if (!track) return 30;
  if (Number(track.duration_ms) > 0) return Number(track.duration_ms) / 1000;
  if (Number(track.duration) > 0) return Number(track.duration);
  return 30;
}

/** Real length of playable file (Spotify preview ~30s; upload = full). */
function loadPlayableDuration(src, fallback = 30) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(fallback);
      return;
    }
    let settled = false;
    const done = (v) => {
      if (settled) return;
      settled = true;
      const n = Number(v);
      // Ignore Infinity / NaN / weird values
      if (!Number.isFinite(n) || n <= 0 || n > 1e5) {
        resolve(fallback);
        return;
      }
      resolve(n);
    };
    try {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => done(a.duration);
      a.onerror = () => done(fallback);
      setTimeout(() => done(fallback), 5000);
      a.src = src;
    } catch {
      done(fallback);
    }
  });
}

/**
 * Fake waveform bars — stable per seed (visual only).
 */
function useWaveBars(seed = "x", count = 56) {
  return useMemo(() => {
    let h = 2166136261;
    const s = String(seed);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const bars = [];
    for (let i = 0; i < count; i++) {
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const v = 0.22 + ((h >>> 0) % 1000) / 1000 * 0.78;
      bars.push(v);
    }
    return bars;
  }, [seed, count]);
}

/**
 * Tìm nhạc + cắt đoạn 30/45/60s + kéo vùng nghe + play loop đoạn đã chọn.
 */
export default function FormSpotifyPicker({
  open,
  onClose,
  onPick,
  loading = false,
}) {
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [library, setLibrary] = useState([]);

  const [selected, setSelected] = useState(null);
  /** Length of actual playable audio (seconds) */
  const [playableDur, setPlayableDur] = useState(30);
  /** Desired clip length: 30 | 45 | 60 (clamped to playableDur) */
  const [clipLen, setClipLen] = useState(30);
  /** Window start within playable audio */
  const [startTime, setStartTime] = useState(0);
  const [clipPlaying, setClipPlaying] = useState(false);
  /** Absolute position in playable file */
  const [playhead, setPlayhead] = useState(0);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const searchTimer = useRef(null);
  const audioRef = useRef(null);
  const srcKeyRef = useRef("");
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const timelineRef = useRef(null);
  const dragRef = useRef(null);
  const startTimeRef = useRef(0);
  const endTimeRef = useRef(30);
  const playingRef = useRef(false);

  // Effective clip length never exceeds file
  const effectiveClip = Math.min(clipLen, playableDur);
  const maxStart = Math.max(0, playableDur - effectiveClip);
  const endTime = Math.min(playableDur, startTime + effectiveClip);

  startTimeRef.current = startTime;
  endTimeRef.current = endTime;

  const waveBars = useWaveBars(
    selected?.id || selected?.spotify_url || selected?.song_title || "x",
    56,
  );

  const stopAudio = useCallback(() => {
    playingRef.current = false;
    try {
      audioRef.current?.pause();
    } catch {
      /* ignore */
    }
    setClipPlaying(false);
  }, []);

  const ensureAudio = useCallback((src) => {
    if (!src) return null;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
    }
    const a = audioRef.current;
    a.volume = 1;
    a.muted = false;
    if (srcKeyRef.current !== src) {
      srcKeyRef.current = src;
      a.src = src;
      try {
        a.load();
      } catch {
        /* ignore */
      }
    }
    return a;
  }, []);

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showModal]);

  useEffect(() => {
    if (open) {
      setShowModal(true);
      setTimeout(() => setAnimate(true), 10);
      setTimeout(() => inputRef.current?.focus(), 100);
      listMusicTracks()
        .then((list) => setLibrary(Array.isArray(list) ? list : []))
        .catch(() => setLibrary([]));
    } else {
      setAnimate(false);
      setTimeout(() => setShowModal(false), 300);
      setQuery("");
      setResults([]);
      setSelected(null);
      stopAudio();
      srcKeyRef.current = "";
    }
  }, [open, stopAudio]);

  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        let list = [];
        try {
          list = await searchMusicLibrary(q, 40);
        } catch {
          list = await searchMusicByQuery(q, 40);
        }
        const normalized = (Array.isArray(list) ? list : []).map((t) => {
          if (t._raw) return { ...t._raw, ...t };
          if (t.song_title || t.song_name || t.preview_url) return t;
          return {
            id: t.id,
            song_title: t.title,
            song_name: t.title,
            name: t.title,
            artist: t.artist,
            image_url: t.coverUrl || t.cover_url || "",
            preview_url: t.preview_url || t.audioUrl || "",
            duration_ms: (t.duration || 0) * 1000,
            spotify_url: t.spotify_url || null,
            source: t.source || "library",
            musicTrackId: t.id,
            platform: t.platform || t.source || "upload",
          };
        });
        setResults(normalized);
      } catch (e) {
        SonnerError(
          "Tìm nhạc lỗi",
          e?.message || "API chậm / lỗi — thử lại sau",
        );
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, open]);

  // Loop only selected window while playing
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !selected) return;

    const onTime = () => {
      if (!playingRef.current) return;
      const t = a.currentTime;
      const s = startTimeRef.current;
      const e = endTimeRef.current;
      setPlayhead(t);

      if (t >= e - 0.06) {
        try {
          a.currentTime = s;
        } catch {
          /* ignore */
        }
        setPlayhead(s);
        return;
      }
      if (t < s - 0.12) {
        try {
          a.currentTime = s;
        } catch {
          /* ignore */
        }
        setPlayhead(s);
      }
    };

    const onEnded = () => {
      if (!playingRef.current) return;
      try {
        a.currentTime = startTimeRef.current;
        a.play().catch(() => {
          playingRef.current = false;
          setClipPlaying(false);
        });
      } catch {
        playingRef.current = false;
        setClipPlaying(false);
      }
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
    };
  }, [selected]);

  const openClipEditor = async (track) => {
    if (!track || loading) return;

    const src = trackSrc(track);
    if (!src) {
      SonnerInfo("Bài này không có file nghe thử — thử bài khác hoặc tải lên");
      return;
    }

    stopAudio();
    setSelected(track);
    setLoadingMeta(true);
    setPlayhead(0);
    setStartTime(0);

    try {
      const fallback = Math.min(metaDurationSec(track), 30);
      const playable = await loadPlayableDuration(src, fallback);
      const dur = Math.max(1, Math.min(Number(playable) || fallback, 600));

      setPlayableDur(dur);

      // Default: longest chip that fits (30 / 45 / 60)
      let best = CLIP_OPTIONS[0];
      for (const n of CLIP_OPTIONS) {
        if (n <= dur + 0.35) best = n;
      }
      // If file shorter than 30, use full file
      if (dur < 30) best = Math.floor(dur) || dur;

      setClipLen(best >= 30 ? best : 30);
      setStartTime(0);
      setPlayhead(0);
      ensureAudio(src);
    } catch (err) {
      console.warn("[openClipEditor]", err);
      SonnerError("Không mở được bài này", err?.message || "Thử lại");
      setSelected(null);
    } finally {
      setLoadingMeta(false);
    }
  };

  /** Change clip length 30/45/60 — keep start in range */
  const chooseClipLen = (sec) => {
    const len = Math.min(sec, playableDur);
    if (len < 1) return;
    // If file too short for this chip, still allow but clamp length
    if (sec > playableDur + 0.4 && playableDur < sec) {
      SonnerInfo(
        playableDur < 35
          ? `Preview chỉ ~${Math.round(playableDur)}s — tải file dài hơn để cắt ${sec}s`
          : `File chỉ dài ${formatSec(playableDur)} — dùng tối đa ${formatSec(playableDur)}`,
      );
    }
    const nextLen = Math.min(sec, playableDur);
    setClipLen(sec); // keep desired chip selected for UI
    setStartTime((s) => {
      const maxS = Math.max(0, playableDur - nextLen);
      return Math.min(s, maxS);
    });
    setPlayhead((p) => {
      const maxS = Math.max(0, playableDur - nextLen);
      const st = Math.min(startTime, maxS);
      if (p < st || p > st + nextLen) return st;
      return p;
    });
    // Seek if playing
    const a = audioRef.current;
    if (a && playingRef.current) {
      const maxS = Math.max(0, playableDur - nextLen);
      const st = Math.min(startTime, maxS);
      try {
        a.currentTime = st;
      } catch {
        /* ignore */
      }
    }
  };

  /** Move window start (drag timeline / range) */
  const moveStart = (raw) => {
    const nextLen = Math.min(clipLen, playableDur);
    const maxS = Math.max(0, playableDur - nextLen);
    const next = Math.max(0, Math.min(Number(raw) || 0, maxS));
    setStartTime(next);
    setPlayhead(next);
    const a = audioRef.current;
    if (a) {
      try {
        a.currentTime = next;
      } catch {
        /* ignore */
      }
    }
  };

  const handleUploadFile = async (e) => {
    const file = e.target?.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const duration = await new Promise((resolve) => {
        try {
          const a = new Audio();
          const url = URL.createObjectURL(file);
          a.preload = "metadata";
          a.onloadedmetadata = () => {
            resolve(Number(a.duration) || 0);
            URL.revokeObjectURL(url);
          };
          a.onerror = () => {
            resolve(0);
            URL.revokeObjectURL(url);
          };
          a.src = url;
        } catch {
          resolve(0);
        }
      });
      const track = await uploadMusicTrack(file, {
        title: file.name.replace(/\.[^.]+$/, ""),
        duration,
      });
      SonnerSuccess("Đã tải nhạc lên thư viện");
      setLibrary((prev) => [track, ...prev]);
      await openClipEditor({
        id: track.id,
        song_title: track.title,
        song_name: track.title,
        name: track.title,
        artist: track.artist || "",
        image_url: track.coverUrl || "",
        preview_url: track.audioUrl,
        duration_ms: (track.duration || duration || 0) * 1000,
        source: "upload",
        musicTrackId: track.id,
        platform: "upload",
      });
    } catch (err) {
      SonnerError("Upload nhạc thất bại", err?.message || "");
    } finally {
      setUploading(false);
    }
  };

  const previewPlay = (track) => {
    const src = trackSrc(track);
    if (!src) {
      SonnerInfo("Bài này không có preview");
      return;
    }
    try {
      const a = ensureAudio(src);
      if (!a) return;
      if (!a.paused && srcKeyRef.current === src) {
        a.pause();
        return;
      }
      a.currentTime = 0;
      a.play().catch(() => SonnerInfo("Không phát được preview"));
    } catch {
      /* ignore */
    }
  };

  const toggleClipPreview = async () => {
    const src = trackSrc(selected);
    if (!src) {
      SonnerInfo("Không có audio để nghe");
      return;
    }

    try {
      const a = ensureAudio(src);
      if (!a) return;

      if (playingRef.current && !a.paused) {
        a.pause();
        playingRef.current = false;
        setClipPlaying(false);
        return;
      }

      if (a.readyState < 2) {
        await new Promise((resolve) => {
          const done = () => {
            a.removeEventListener("canplay", done);
            a.removeEventListener("loadeddata", done);
            resolve();
          };
          a.addEventListener("canplay", done);
          a.addEventListener("loadeddata", done);
          setTimeout(done, 4000);
        });
      }

      const s = startTimeRef.current;
      try {
        a.currentTime = s;
      } catch {
        /* ignore */
      }

      await a.play();
      requestAnimationFrame(() => {
        try {
          if (Math.abs(a.currentTime - s) > 0.35) a.currentTime = s;
        } catch {
          /* ignore */
        }
      });
      setTimeout(() => {
        try {
          if (Math.abs(a.currentTime - s) > 0.35) a.currentTime = s;
        } catch {
          /* ignore */
        }
      }, 60);

      playingRef.current = true;
      setClipPlaying(true);
      setPlayhead(s);
    } catch (err) {
      playingRef.current = false;
      setClipPlaying(false);
      console.warn("[clip play]", err);
      SonnerInfo("Không phát được — chạm Play lại");
    }
  };

  // Timeline drag: move selection window
  const clientXToStart = (clientX) => {
    const el = timelineRef.current;
    if (!el || playableDur <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const clickT = ratio * playableDur;
    // Center window on click / drag position
    const nextLen = Math.min(clipLen, playableDur);
    return clickT - nextLen / 2;
  };

  const onTimelinePointerDown = (e) => {
    if (!timelineRef.current || playableDur <= 0) return;
    e.preventDefault();
    moveStart(clientXToStart(e.clientX));
    dragRef.current = true;
    try {
      timelineRef.current.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onTimelinePointerMove = (e) => {
    if (!dragRef.current) return;
    e.preventDefault();
    moveStart(clientXToStart(e.clientX));
  };

  const onTimelinePointerUp = (e) => {
    dragRef.current = false;
    try {
      timelineRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const confirmClip = () => {
    if (!selected || loading) return;
    const src = trackSrc(selected);
    if (!src) {
      SonnerInfo("Bài không có audio — không gắn được");
      return;
    }
    stopAudio();
    const nextLen = Math.min(clipLen, playableDur);
    const s = Math.max(0, Math.min(startTime, Math.max(0, playableDur - nextLen)));
    const e = Math.min(playableDur, s + nextLen);
    onPick?.({
      ...selected,
      preview_url: src,
      audioUrl: src,
      startTime: s,
      endTime: Math.max(s + 0.5, e),
      volume: 1,
      originalVideoVolume: 1,
      duration: playableDur,
      duration_ms: selected.duration_ms || playableDur * 1000,
    });
  };

  const backToList = () => {
    stopAudio();
    setSelected(null);
    setPlayhead(0);
  };

  if (!showModal) return null;

  const title =
    selected?.song_title || selected?.song_name || selected?.name || "";
  const artist = selected?.artist || "";
  const nextLen = Math.min(clipLen, playableDur);
  const selLeft = playableDur > 0 ? (startTime / playableDur) * 100 : 0;
  const selWidth =
    playableDur > 0 ? (nextLen / playableDur) * 100 : 100;
  const headPct =
    playableDur > 0 ? Math.min(100, Math.max(0, (playhead / playableDur) * 100)) : 0;
  const isShortPreview = playableDur > 0 && playableDur < 35;

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/40 backdrop-blur-[6px] transition-opacity duration-400 z-[99] text-base-content",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={!loading && !selected ? onClose : undefined}
    >
      <div
        className={clsx(
          "fixed border-t border-base-300 bottom-0 left-0 w-full max-h-[92vh] bg-base-100 rounded-t-4xl shadow-2xl transition-all duration-400 ease-out z-[100] flex flex-col",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          },
          selected && "bg-white text-neutral-900",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {!selected && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-base-300" />
          </div>
        )}

        {selected ? (
          <div className="flex flex-col min-h-[62vh]">
            <header className="flex items-center justify-between px-4 pt-4 pb-2">
              <button
                type="button"
                onClick={backToList}
                className="p-2 -ml-1 rounded-full hover:bg-black/5"
                aria-label="Đóng"
              >
                <X className="w-6 h-6 text-neutral-800" />
              </button>
              <button
                type="button"
                onClick={confirmClip}
                disabled={loading || loadingMeta || !trackSrc(selected)}
                className="text-[17px] font-semibold text-sky-500 disabled:opacity-40 px-2"
              >
                {loading ? "…" : "Xong"}
              </button>
            </header>

            <div className="flex-1 flex flex-col items-center px-5 pt-2 pb-6">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-neutral-200 shadow-md mb-4">
                {selected.image_url ? (
                  <img
                    src={selected.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Music2 className="w-10 h-10 text-neutral-400" />
                  </div>
                )}
              </div>

              <h2 className="text-lg font-bold text-center text-neutral-900 px-2 leading-snug">
                {title}
              </h2>
              <p className="text-sm text-neutral-500 mt-1 mb-6">{artist}</p>

              {loadingMeta ? (
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400 my-10" />
              ) : (
                <div className="w-full max-w-md flex flex-col gap-5">
                  {/* 30 / 45 / 60 + Play */}
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    {CLIP_OPTIONS.map((sec) => {
                      const fits = playableDur + 0.4 >= sec;
                      const chipOn = clipLen === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => chooseClipLen(sec)}
                          className={clsx(
                            "min-w-[3.25rem] h-10 px-3 rounded-full text-sm font-semibold transition",
                            chipOn
                              ? "bg-neutral-800 text-white"
                              : fits
                                ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                : "bg-neutral-50 text-neutral-400",
                          )}
                          title={
                            fits
                              ? `Cắt ${sec}s`
                              : `File chỉ ~${Math.round(playableDur)}s — cần tải MP3 dài hơn`
                          }
                        >
                          {sec}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={toggleClipPreview}
                      className="w-11 h-11 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 active:scale-95 transition"
                      aria-label={clipPlaying ? "Tạm dừng" : "Phát đoạn"}
                    >
                      {clipPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Timeline: drag to move clip window */}
                  <div className="w-full">
                    <div
                      ref={timelineRef}
                      className="relative w-full h-[4.5rem] select-none touch-none cursor-grab active:cursor-grabbing rounded-xl bg-neutral-100 overflow-hidden"
                      onPointerDown={onTimelinePointerDown}
                      onPointerMove={onTimelinePointerMove}
                      onPointerUp={onTimelinePointerUp}
                      onPointerCancel={onTimelinePointerUp}
                      role="slider"
                      aria-valuemin={0}
                      aria-valuemax={maxStart}
                      aria-valuenow={startTime}
                      aria-label="Kéo để chọn đoạn nghe"
                    >
                      {/* Waveform background */}
                      <div className="absolute inset-0 flex items-center gap-[2px] px-1 opacity-35 pointer-events-none">
                        {waveBars.map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-sm bg-neutral-500"
                            style={{ height: `${h * 88}%` }}
                          />
                        ))}
                      </div>

                      {/* Selected window */}
                      <div
                        className="absolute top-1 bottom-1 rounded-lg border-2 border-sky-500 bg-sky-400/30 overflow-hidden pointer-events-none"
                        style={{
                          left: `${selLeft}%`,
                          width: `${Math.max(selWidth, 3)}%`,
                        }}
                      >
                        <div className="absolute inset-0 flex items-center gap-[2px] px-0.5">
                          {waveBars.map((h, i) => (
                            <div
                              key={i}
                              className="flex-1 rounded-sm bg-sky-600/70"
                              style={{ height: `${h * 88}%` }}
                            />
                          ))}
                        </div>
                        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-9 bg-sky-500 rounded-full" />
                        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-1 h-9 bg-sky-500 rounded-full" />
                      </div>

                      {/* Playhead */}
                      {clipPlaying || playhead > startTime + 0.05 ? (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-sky-700 pointer-events-none z-10"
                          style={{ left: `${headPct}%` }}
                        />
                      ) : null}
                    </div>

                    <p className="text-center text-xs text-neutral-500 mt-2 tabular-nums">
                      {formatSec(startTime)} – {formatSec(endTime)} · đoạn{" "}
                      {formatSec(endTime - startTime)}
                      {isShortPreview
                        ? ` · preview ~${Math.round(playableDur)}s`
                        : ` / ${formatSec(playableDur)}`}
                    </p>
                  </div>

                  {/* Fine scrub: move start of window */}
                  <div className="w-full">
                    <label className="text-xs text-neutral-500 mb-1.5 block">
                      Di chuyển đoạn cần nghe
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0.01, maxStart)}
                      step={0.05}
                      value={Math.min(startTime, maxStart)}
                      onChange={(e) => moveStart(e.target.value)}
                      disabled={maxStart < 0.05}
                      className="w-full h-2 accent-sky-500 cursor-pointer disabled:opacity-40"
                      aria-label="Vị trí đoạn cắt"
                    />
                    {maxStart < 0.05 ? (
                      <p className="text-[11px] text-neutral-400 mt-1">
                        File ngắn — dùng hết ~{formatSec(playableDur)} (không kéo thêm được)
                      </p>
                    ) : null}
                  </div>

                  {isShortPreview ? (
                    <p className="text-[11px] text-amber-700/90 text-center bg-amber-50 rounded-xl px-3 py-2">
                      Spotify/Deezer chỉ cho nghe thử ~30s → không cắt được 45s/60s.
                      Muốn 45–60s: bấm <b>Tải lên</b> file MP3 dài hơn.
                    </p>
                  ) : null}

                  <p className="text-center text-xs text-neutral-400">
                    Kéo waveform / thanh dưới để chọn đoạn · Play để nghe · Xong để gắn
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 pb-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-red-500 to-cyan-400 flex items-center justify-center shadow-md shrink-0">
                <Music2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold leading-tight">Tìm nhạc</h3>
                <p className="text-xs text-base-content/60 truncate">
                  Chọn bài → cắt 30/45/60s → kéo đoạn nghe → Xong
                </p>
              </div>
            </div>

            <div className="px-4 pb-2 flex gap-2">
              <label className="flex flex-1 items-center gap-2 bg-base-200 rounded-2xl px-3 py-2.5">
                <Search className="w-4 h-4 opacity-50 shrink-0" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="VD: Blinding Lights, Sơn Tùng..."
                  className="bg-transparent outline-none w-full text-sm font-medium placeholder:text-base-content/40"
                  autoFocus
                />
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin opacity-60" />
                ) : null}
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac"
                className="hidden"
                onChange={handleUploadFile}
              />
              <button
                type="button"
                disabled={uploading || loading}
                onClick={() => fileRef.current?.click()}
                className="shrink-0 px-3 py-2.5 rounded-2xl bg-primary/15 text-primary text-xs font-semibold disabled:opacity-50"
              >
                {uploading ? "…" : "Tải lên"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3 min-h-[220px] max-h-[50vh]">
              {query.trim().length < 2 && library.length > 0 ? (
                <>
                  <p className="text-xs text-base-content/50 px-3 py-2">
                    Thư viện của bạn
                  </p>
                  {library.map((track) => (
                    <button
                      key={track.id}
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        openClipEditor({
                          id: track.id,
                          song_title: track.title,
                          song_name: track.title,
                          name: track.title,
                          artist: track.artist,
                          image_url: track.coverUrl,
                          preview_url: track.audioUrl,
                          duration_ms: (track.duration || 0) * 1000,
                          source: track.source || "library",
                          musicTrackId: track.id,
                          platform: "upload",
                        })
                      }
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-base-200 text-left"
                    >
                      <div className="w-12 h-12 rounded-lg bg-base-300 flex items-center justify-center shrink-0">
                        <Music2 className="w-5 h-5 opacity-40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">
                          {track.title}
                        </div>
                        <div className="text-xs text-base-content/60 truncate">
                          {track.artist || "Local"}
                          {track.duration
                            ? ` · ${formatSec(track.duration)}`
                            : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              ) : query.trim().length < 2 ? (
                <p className="text-center text-sm text-base-content/50 py-10 px-4">
                  Nhập để tìm Spotify / hoặc tải MP3 dài để cắt 45–60s
                </p>
              ) : searching && !results.length ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin opacity-50" />
                </div>
              ) : !results.length ? (
                <p className="text-center text-sm text-base-content/50 py-10 px-4">
                  Không tìm thấy — thử từ khóa khác
                </p>
              ) : (
                results.map((track) => (
                  <button
                    key={track.id || track.spotify_url || track.title}
                    type="button"
                    disabled={loading}
                    onClick={() => openClipEditor(track)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-base-200 active:scale-[0.99] transition text-left disabled:opacity-60"
                  >
                    <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-base-300">
                      {track.image_url ? (
                        <img
                          src={track.image_url}
                          alt=""
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music2 className="w-5 h-5 opacity-40" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {track.song_title || track.song_name || track.name}
                      </div>
                      <div className="text-xs text-base-content/60 truncate">
                        {track.artist}
                        {track.duration_ms
                          ? ` · ${formatMs(track.duration_ms)}`
                          : ""}
                      </div>
                    </div>
                    {trackSrc(track) ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          previewPlay(track);
                        }}
                        className="text-xs font-semibold text-primary px-2 py-1 rounded-full bg-primary/10 shrink-0"
                      >
                        Nghe
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>

            <div className="px-4 pb-5 pt-1 border-t border-base-200 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn btn-neutral btn-outline flex-1 rounded-3xl"
              >
                Hủy
              </button>
              {loading ? (
                <button
                  type="button"
                  disabled
                  className="btn btn-primary flex-1 rounded-3xl gap-2"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang gắn...
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
