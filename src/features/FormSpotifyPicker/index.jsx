import clsx from "clsx";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  Loader2,
  Music2,
  Search,
  Play,
  Square,
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

function metaDurationSec(track) {
  if (!track) return 30;
  if (track.duration_ms > 0) return track.duration_ms / 1000;
  if (track.duration > 0) return Number(track.duration);
  if (track.preview_url) return 30;
  return 30;
}

/** Load real playable length from audio URL (Spotify preview ~30s). */
function loadPlayableDuration(src, fallback = 30) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(fallback);
      return;
    }
    try {
      const a = new Audio();
      a.preload = "metadata";
      const done = (v) => {
        const n = Number(v);
        resolve(Number.isFinite(n) && n > 0 && n < 1e6 ? n : fallback);
      };
      a.onloadedmetadata = () => done(a.duration);
      a.onerror = () => done(fallback);
      setTimeout(() => done(fallback), 8000);
      a.src = src;
    } catch {
      resolve(fallback);
    }
  });
}

/** Fake waveform bars (stable per track id) */
function useWaveBars(seed = "x", count = 64) {
  return useMemo(() => {
    let h = 0;
    for (let i = 0; i < String(seed).length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const bars = [];
    for (let i = 0; i < count; i++) {
      h = (h * 1103515245 + 12345) >>> 0;
      const v = 0.25 + ((h % 1000) / 1000) * 0.75;
      bars.push(v);
    }
    return bars;
  }, [seed, count]);
}

/**
 * Tìm nhạc + UI cắt đoạn (30/45/60s) kiểu Locket.
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
  const [playableDur, setPlayableDur] = useState(30);
  const [clipLen, setClipLen] = useState(30); // 30 | 45 | 60
  const [startTime, setStartTime] = useState(0);
  const [clipPlaying, setClipPlaying] = useState(false);
  const [clipPos, setClipPos] = useState(0);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const searchTimer = useRef(null);
  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const waveRef = useRef(null);
  const dragRef = useRef(null);

  const endTime = Math.min(playableDur, startTime + clipLen);
  const waveBars = useWaveBars(
    selected?.id || selected?.spotify_url || selected?.song_title || "x",
    72,
  );

  const stopAudio = useCallback(() => {
    try {
      audioRef.current?.pause();
    } catch {
      /* ignore */
    }
    setClipPlaying(false);
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
          if (t.song_title || t.song_name) return t;
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

  // Loop clip segment while playing
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !selected) return;

    const onTime = () => {
      const t = a.currentTime;
      setClipPos(t);
      if (t >= endTime - 0.08 || t < startTime - 0.05) {
        try {
          a.currentTime = startTime;
        } catch {
          /* ignore */
        }
      }
    };
    const onEnded = () => {
      try {
        a.currentTime = startTime;
        a.play().catch(() => setClipPlaying(false));
      } catch {
        setClipPlaying(false);
      }
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
    };
  }, [selected, startTime, endTime]);

  const openClipEditor = async (track) => {
    if (!track || loading) return;
    stopAudio();
    setSelected(track);
    setLoadingMeta(true);
    setClipPos(0);

    const src = track.preview_url || track.audioUrl;
    const fallback = metaDurationSec(track);
    const playable = await loadPlayableDuration(src, fallback);
    const dur = Math.max(1, Math.min(playable, 600));
    setPlayableDur(dur);

    // Default clip length: longest allowed ≤ track
    const allowed = CLIP_OPTIONS.filter((n) => n <= dur + 0.25);
    const len = allowed.length ? allowed[allowed.length - 1] : Math.min(30, dur);
    setClipLen(len);
    setStartTime(0);
    setLoadingMeta(false);

    // Prefetch audio for smooth play
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      const a = audioRef.current;
      a.preload = "auto";
      a.volume = 1;
      if (src) {
        a.src = src;
        a.load();
      }
    } catch {
      /* ignore */
    }
  };

  const setClipLength = (sec) => {
    const len = Math.min(sec, playableDur);
    setClipLen(len);
    setStartTime((s) => Math.min(s, Math.max(0, playableDur - len)));
  };

  const setWindowStart = (s) => {
    const maxStart = Math.max(0, playableDur - clipLen);
    const next = Math.max(0, Math.min(Number(s) || 0, maxStart));
    setStartTime(next);
    if (audioRef.current && clipPlaying) {
      try {
        audioRef.current.currentTime = next;
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
    const src = track?.preview_url || track?.audioUrl;
    if (!src) {
      SonnerInfo("Bài này không có preview");
      return;
    }
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      const a = audioRef.current;
      if (a.src === src && !a.paused) {
        a.pause();
        return;
      }
      a.src = src;
      a.volume = 1;
      a.play().catch(() => {});
    } catch {
      /* ignore */
    }
  };

  const toggleClipPreview = async () => {
    const src = selected?.preview_url || selected?.audioUrl;
    if (!src) {
      SonnerInfo("Không có audio để nghe đoạn này");
      return;
    }
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      const a = audioRef.current;
      a.volume = 1;
      if (!a.src || !a.src.includes(src.split("?")[0].slice(-20))) {
        a.src = src;
        a.load();
        await new Promise((r) => {
          a.oncanplay = () => r();
          setTimeout(r, 2000);
        });
      }
      if (!a.paused && clipPlaying) {
        a.pause();
        setClipPlaying(false);
        return;
      }
      // Seek to clip start then play
      const seek = () => {
        try {
          a.currentTime = startTime;
        } catch {
          /* ignore */
        }
      };
      seek();
      await a.play();
      // Some browsers reset time on play — re-seek once
      requestAnimationFrame(seek);
      setTimeout(seek, 50);
      setClipPlaying(true);
    } catch {
      setClipPlaying(false);
      SonnerInfo("Không phát được — chạm lại để thử");
    }
  };

  const confirmClip = () => {
    if (!selected || loading) return;
    stopAudio();
    const s = Math.max(0, Math.min(startTime, playableDur));
    const e = Math.min(playableDur, s + clipLen);
    onPick?.({
      ...selected,
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
  };

  // Waveform drag to move selection window
  const onWavePointerDown = (e) => {
    if (!waveRef.current || playableDur <= 0) return;
    const rect = waveRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const clickT = ratio * playableDur;
    // Center window on click if possible
    const maxStart = Math.max(0, playableDur - clipLen);
    setWindowStart(clickT - clipLen / 2);
    dragRef.current = { rect, maxStart };
    waveRef.current.setPointerCapture?.(e.pointerId);
  };

  const onWavePointerMove = (e) => {
    if (!dragRef.current || !waveRef.current) return;
    const { rect, maxStart } = dragRef.current;
    const ratio = (e.clientX - rect.left) / rect.width;
    const t = ratio * playableDur - clipLen / 2;
    setWindowStart(Math.max(0, Math.min(t, maxStart)));
  };

  const onWavePointerUp = (e) => {
    dragRef.current = null;
    try {
      waveRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  if (!showModal) return null;

  const title =
    selected?.song_title || selected?.song_name || selected?.name || "";
  const artist = selected?.artist || "";
  const selLeft = playableDur > 0 ? (startTime / playableDur) * 100 : 0;
  const selWidth =
    playableDur > 0 ? (Math.min(clipLen, playableDur) / playableDur) * 100 : 100;
  const playHead =
    playableDur > 0 ? Math.min(100, (clipPos / playableDur) * 100) : 0;

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

        {/* ═══ CLIP EDITOR (Locket-style) ═══ */}
        {selected ? (
          <div className="flex flex-col min-h-[70vh]">
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
                disabled={loading || loadingMeta}
                className="text-[17px] font-semibold text-sky-500 disabled:opacity-40 px-2"
              >
                {loading ? "…" : "Xong"}
              </button>
            </header>

            <div className="flex-1 flex flex-col items-center px-6 pt-6 pb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-neutral-200 shadow-md mb-5">
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
              <p className="text-sm text-neutral-500 mt-1 mb-8">{artist}</p>

              {loadingMeta ? (
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400 my-8" />
              ) : (
                <>
                  {/* Duration chips: 30 / 45 / 60 */}
                  <div className="flex items-center gap-3 mb-6 w-full max-w-sm justify-center">
                    {CLIP_OPTIONS.map((sec) => {
                      const ok = playableDur + 0.2 >= sec || sec === CLIP_OPTIONS[0];
                      const active = Math.abs(clipLen - sec) < 0.5 ||
                        (sec === CLIP_OPTIONS[0] && clipLen < 30 && clipLen === Math.min(30, playableDur));
                      const disabled = playableDur < sec - 0.5 && sec > 30;
                      // Allow 30 even if shorter track (uses full)
                      const canUse = sec <= playableDur + 0.5 || (sec === 30 && playableDur > 0);
                      return (
                        <button
                          key={sec}
                          type="button"
                          disabled={!canUse}
                          onClick={() => setClipLength(Math.min(sec, playableDur))}
                          className={clsx(
                            "min-w-[3.25rem] h-10 px-3 rounded-full text-sm font-semibold transition",
                            clipLen === Math.min(sec, playableDur) ||
                              (Math.min(sec, playableDur) === clipLen)
                              ? "bg-neutral-200 text-neutral-900 ring-2 ring-neutral-400"
                              : "bg-neutral-100 text-neutral-600",
                            !canUse && "opacity-30 cursor-not-allowed",
                          )}
                        >
                          {sec}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={toggleClipPreview}
                      className="w-10 h-10 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0"
                      aria-label={clipPlaying ? "Dừng" : "Phát"}
                    >
                      {clipPlaying ? (
                        <Square className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Waveform + selection window */}
                  <div
                    ref={waveRef}
                    className="relative w-full max-w-md h-16 select-none touch-none cursor-grab active:cursor-grabbing"
                    onPointerDown={onWavePointerDown}
                    onPointerMove={onWavePointerMove}
                    onPointerUp={onWavePointerUp}
                    onPointerCancel={onWavePointerUp}
                    role="slider"
                    aria-valuemin={0}
                    aria-valuemax={Math.max(0, playableDur - clipLen)}
                    aria-valuenow={startTime}
                    aria-label="Vùng cắt nhạc"
                  >
                    {/* Full waveform */}
                    <div className="absolute inset-0 flex items-center gap-[2px] px-0.5 opacity-40">
                      {waveBars.map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-neutral-400"
                          style={{ height: `${h * 100}%` }}
                        />
                      ))}
                    </div>

                    {/* Selection highlight */}
                    <div
                      className="absolute top-0 bottom-0 rounded-lg border-2 border-sky-500 bg-sky-500/25 overflow-hidden pointer-events-none"
                      style={{
                        left: `${selLeft}%`,
                        width: `${Math.max(selWidth, 4)}%`,
                      }}
                    >
                      <div className="absolute inset-0 flex items-center gap-[2px] px-0.5">
                        {waveBars.map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-sm bg-sky-600/80"
                            style={{ height: `${h * 100}%` }}
                          />
                        ))}
                      </div>
                      {/* handles */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-sky-500 rounded-full" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-sky-500 rounded-full" />
                    </div>

                    {/* Playhead */}
                    {clipPlaying && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-sky-600 pointer-events-none z-10"
                        style={{ left: `${playHead}%` }}
                      />
                    )}
                  </div>

                  <p className="text-xs text-neutral-500 mt-3 tabular-nums">
                    {formatSec(startTime)} – {formatSec(endTime)} ·{" "}
                    {formatSec(endTime - startTime)}
                    {playableDur < 35
                      ? " (preview Spotify ~30s)"
                      : ` / ${formatSec(playableDur)}`}
                  </p>

                  {/* Fine scrub start position */}
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0.01, playableDur - clipLen)}
                    step={0.05}
                    value={Math.min(startTime, Math.max(0, playableDur - clipLen))}
                    onChange={(e) => setWindowStart(e.target.value)}
                    className="w-full max-w-md mt-4 accent-sky-500"
                    aria-label="Vị trí đoạn cắt"
                  />
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* ═══ SEARCH LIST ═══ */}
            <div className="px-5 pb-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-red-500 to-cyan-400 flex items-center justify-center shadow-md shrink-0">
                <Music2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold leading-tight">Tìm nhạc</h3>
                <p className="text-xs text-base-content/60 truncate">
                  Chọn bài → cắt đoạn 30/45/60s → gắn caption
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
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              ) : query.trim().length < 2 ? (
                <p className="text-center text-sm text-base-content/50 py-10 px-4">
                  Nhập để tìm Spotify / hoặc tải nhạc từ máy
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
                    {track.preview_url ? (
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
