import clsx from "clsx";
import React, { useEffect, useRef, useState, useCallback } from "react";
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
  return track?.preview_url || track?.audioUrl || track?.audio_url || "";
}

function metaDurationSec(track) {
  if (!track) return 30;
  if (track.duration_ms > 0) return track.duration_ms / 1000;
  if (track.duration > 0) return Number(track.duration);
  if (trackSrc(track)) return 30;
  return 30;
}

/** Load real playable length from audio URL (Spotify preview ~30s). */
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
      resolve(Number.isFinite(n) && n > 0 && n < 1e6 ? n : fallback);
    };
    try {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => done(a.duration);
      a.onerror = () => done(fallback);
      setTimeout(() => done(fallback), 6000);
      a.src = src;
    } catch {
      done(fallback);
    }
  });
}

/**
 * Tìm nhạc + nghe thử bằng 1 thanh progress (không waveform / không chip 30-45-60).
 * Spotify preview ~30s = cả khúc; upload dài hơn thì kéo thanh để chọn vị trí.
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
  /** Full length of playable audio file */
  const [playableDur, setPlayableDur] = useState(30);
  /** Clip window: for short previews = full track; for long uploads user can scrub start */
  const [startTime, setStartTime] = useState(0);
  const [clipLen, setClipLen] = useState(30);
  const [clipPlaying, setClipPlaying] = useState(false);
  /** Position relative to clip start (0..clipLen) for the single progress bar */
  const [clipProgress, setClipProgress] = useState(0);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const searchTimer = useRef(null);
  const audioRef = useRef(null);
  const srcKeyRef = useRef("");
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const startTimeRef = useRef(0);
  const endTimeRef = useRef(30);
  const playingRef = useRef(false);

  const endTime = Math.min(playableDur, startTime + clipLen);
  const actualClipLen = Math.max(0.5, endTime - startTime);

  startTimeRef.current = startTime;
  endTimeRef.current = endTime;

  const stopAudio = useCallback(() => {
    playingRef.current = false;
    try {
      const a = audioRef.current;
      if (a) {
        a.pause();
      }
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

  // Keep playback inside [start, end] and update the single progress bar
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !selected) return;

    const onTime = () => {
      if (!playingRef.current) return;
      const t = a.currentTime;
      const s = startTimeRef.current;
      const e = endTimeRef.current;
      if (t >= e - 0.05) {
        // Loop only the selected clip
        try {
          a.currentTime = s;
        } catch {
          /* ignore */
        }
        setClipProgress(0);
        return;
      }
      if (t < s - 0.1) {
        try {
          a.currentTime = s;
        } catch {
          /* ignore */
        }
        setClipProgress(0);
        return;
      }
      setClipProgress(Math.max(0, t - s));
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

    const onPause = () => {
      // only sync UI if we didn't intend to play
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnded);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("pause", onPause);
    };
  }, [selected]);

  const openClipEditor = async (track) => {
    if (!track || loading) return;
    stopAudio();
    setSelected(track);
    setLoadingMeta(true);
    setClipProgress(0);
    setStartTime(0);

    const src = trackSrc(track);
    if (!src) {
      setLoadingMeta(false);
      SonnerInfo("Bài này không có file nghe thử");
      return;
    }

    const fallback = metaDurationSec(track);
    const playable = await loadPlayableDuration(src, fallback);
    // Cap weird Infinity / NaN
    const dur = Math.max(1, Math.min(Number(playable) || fallback, 600));
    setPlayableDur(dur);
    // Clip = toàn bộ file nghe được (preview Spotify ~30s hoặc full upload)
    setClipLen(dur);
    setStartTime(0);
    setClipProgress(0);
    setLoadingMeta(false);

    ensureAudio(src);
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

  /** List-row quick listen (separate from clip editor) */
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
      a.play().catch(() => {
        SonnerInfo("Không phát được preview");
      });
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

      // Pause if already playing this clip
      if (playingRef.current && !a.paused) {
        a.pause();
        playingRef.current = false;
        setClipPlaying(false);
        return;
      }

      // Wait until we can seek/play
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
      // Re-seek after play (some mobile browsers jump to 0)
      requestAnimationFrame(() => {
        try {
          if (Math.abs(a.currentTime - s) > 0.4) a.currentTime = s;
        } catch {
          /* ignore */
        }
      });
      setTimeout(() => {
        try {
          if (Math.abs(a.currentTime - s) > 0.4) a.currentTime = s;
        } catch {
          /* ignore */
        }
      }, 80);

      playingRef.current = true;
      setClipPlaying(true);
      setClipProgress(Math.max(0, a.currentTime - s));
    } catch (err) {
      playingRef.current = false;
      setClipPlaying(false);
      console.warn("[clip preview]", err);
      SonnerInfo("Không phát được — chạm Play lại");
    }
  };

  /** User drags the single progress bar → seek inside clip */
  const onProgressChange = (e) => {
    const rel = Number(e.target.value) || 0;
    setClipProgress(rel);
    const a = audioRef.current;
    if (!a) return;
    try {
      a.currentTime = startTimeRef.current + rel;
    } catch {
      /* ignore */
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
    setClipProgress(0);
  };

  if (!showModal) return null;

  const title =
    selected?.song_title || selected?.song_name || selected?.name || "";
  const artist = selected?.artist || "";

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

        {/* ═══ CLIP EDITOR — 1 thanh phát khúc ═══ */}
        {selected ? (
          <div className="flex flex-col min-h-[55vh]">
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

            <div className="flex-1 flex flex-col items-center px-6 pt-4 pb-8">
              <div className="w-28 h-28 rounded-full overflow-hidden bg-neutral-200 shadow-md mb-5">
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
              <p className="text-sm text-neutral-500 mt-1 mb-10">{artist}</p>

              {loadingMeta ? (
                <Loader2 className="w-6 h-6 animate-spin text-neutral-400 my-8" />
              ) : !trackSrc(selected) ? (
                <p className="text-sm text-neutral-500 text-center">
                  Bài này không có file nghe thử
                </p>
              ) : (
                <div className="w-full max-w-md flex flex-col gap-5">
                  {/* Play + 1 progress bar for the clip only */}
                  <div className="flex items-center gap-3 w-full">
                    <button
                      type="button"
                      onClick={toggleClipPreview}
                      className="w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center shrink-0 active:scale-95 transition"
                      aria-label={clipPlaying ? "Tạm dừng" : "Phát"}
                    >
                      {clipPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0.1, actualClipLen)}
                        step={0.05}
                        value={Math.min(clipProgress, actualClipLen)}
                        onChange={onProgressChange}
                        className="w-full h-2 accent-sky-500 cursor-pointer"
                        aria-label="Tiến độ khúc nhạc"
                      />
                      <div className="flex justify-between mt-1.5 text-xs text-neutral-500 tabular-nums">
                        <span>{formatSec(startTime + clipProgress)}</span>
                        <span>
                          {playableDur <= 35
                            ? `preview ~${formatSec(actualClipLen)}`
                            : formatSec(actualClipLen)}
                        </span>
                        <span>{formatSec(endTime)}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-xs text-neutral-400">
                    Nhấn Play để nghe khúc này · Xong để gắn caption
                  </p>
                </div>
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
                  Chọn bài → nghe thử → Xong để gắn caption
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
