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
  ChevronLeft,
} from "lucide-react";
import { searchMusicByQuery } from "@/services/ExtensionsServices/MusicServices";
import {
  listMusicTracks,
  uploadMusicTrack,
} from "@/services/ExtensionsServices/MusicLibraryServices";
import { SonnerError, SonnerInfo, SonnerSuccess } from "@/components/ui/SonnerToast";

/** Độ dài clip gợi ý — preview web Spotify ~30s */
const CLIP_OPTIONS = [15, 30];

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

/** Chuẩn hóa VN: bỏ dấu, đ→d, ơ/ư đã NFD */
function normalizeQ(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Soft score — tên bài HOẶC ca sĩ.
 * Server đã lọc; client chỉ sắp xếp, không xóa hết khi tìm theo artist.
 */
function scoreTitleMatch(query, track) {
  const qn = normalizeQ(query);
  const title = normalizeQ(
    track?.song_title || track?.song_name || track?.name || track?.title || "",
  );
  const artist = normalizeQ(track?.artist || "");
  if (!qn) return 0;
  const tokens = qn.split(" ").filter((t) => t.length >= 2);
  if (!tokens.length) return 1;
  const joined = tokens.join(" ");
  const full = `${title} ${artist}`.trim();

  const wordIn = (tok, text) => {
    if (!tok || !text) return false;
    const re = new RegExp(
      `(?:^|\\s)${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`,
    );
    return re.test(text);
  };

  const phraseTitle =
    title && (title === qn || title.includes(qn) || title.startsWith(qn));
  const phraseArtist =
    artist &&
    (artist === qn || artist.includes(qn) || artist.startsWith(qn));
  const allInArtist =
    artist &&
    tokens.every((t) => wordIn(t, artist) || artist.includes(joined));
  const allInTitle =
    title && tokens.every((t) => wordIn(t, title) || title.includes(joined));
  const anyInFull = tokens.some((t) => wordIn(t, full) || full.includes(t));

  let s = 0;
  // Title
  if (title === qn) s += 8000;
  else if (title.startsWith(qn)) s += 4000;
  else if (title.includes(qn)) s += 2500;
  if (tokens.length > 1 && title.includes(joined)) s += 2000;
  for (const tok of tokens) {
    if (wordIn(tok, title)) s += 800;
  }
  // Artist (tìm "sơn tùng", "ed sheeran"…)
  if (artist === qn) s += 7000;
  else if (phraseArtist) s += 5500;
  else if (allInArtist) s += 4500;
  for (const tok of tokens) {
    if (wordIn(tok, artist)) s += 900;
  }

  // Khớp một phần full string
  if (s === 0 && anyInFull) s = 50;
  // Server đã trả về → giữ tối thiểu (không filter trắng)
  if (s === 0 && (title || artist)) s = 10;

  if (track?.isrc) s += 80;
  if (track?.spotify_url) s += 30;
  return s;
}

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
      setTimeout(() => done(fallback), 4000);
      a.src = src;
    } catch {
      done(fallback);
    }
  });
}

/**
 * Tìm nhạc kiểu Spotify + cắt đoạn trước khi gắn.
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
  const [pickingId, setPickingId] = useState(null);

  // Clip editor
  const [selected, setSelected] = useState(null);
  const [playableDur, setPlayableDur] = useState(30);
  const [clipLen, setClipLen] = useState(30);
  const [startTime, setStartTime] = useState(0);
  const [clipPlaying, setClipPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [clipLoading, setClipLoading] = useState(false);

  const searchTimer = useRef(null);
  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const startTimeRef = useRef(0);
  const clipLenRef = useRef(30);
  const playableRef = useRef(30);
  const rafRef = useRef(0);

  const effectiveClip = Math.min(clipLen, playableDur);
  const endTime = Math.min(playableDur, startTime + effectiveClip);
  startTimeRef.current = startTime;
  clipLenRef.current = clipLen;
  playableRef.current = playableDur;

  const stopAudio = useCallback(() => {
    try {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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
      setTimeout(() => inputRef.current?.focus(), 80);
      listMusicTracks()
        .then((list) => setLibrary(Array.isArray(list) ? list : []))
        .catch(() => setLibrary([]));
    } else {
      setAnimate(false);
      setTimeout(() => setShowModal(false), 280);
      setQuery("");
      setResults([]);
      setPickingId(null);
      setSelected(null);
      stopAudio();
    }
  }, [open, stopAudio]);

  // Search — /api/searchMusic (rank server) + filter client cứng
  useEffect(() => {
    if (!open || selected) return;
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
        // Server đã rank theo title + artist — tin API
        let list = await searchMusicByQuery(q, 40);
        // Fallback không dấu nếu rỗng
        if (!list?.length) {
          const bare = normalizeQ(q);
          if (bare && bare !== q.toLowerCase()) {
            list = await searchMusicByQuery(bare, 40);
          }
        }

        const normalized = (Array.isArray(list) ? list : []).map((t) => {
          if (t._raw) {
            return {
              ...t._raw,
              ...t,
              song_title:
                t._raw.song_title ||
                t._raw.song_name ||
                t.title ||
                t.song_title,
              song_name:
                t._raw.song_name ||
                t._raw.song_title ||
                t.title ||
                t.song_name,
              artist: t._raw.artist || t.artist || "",
              preview_url:
                t._raw.preview_url || t.preview_url || t.audioUrl || "",
              image_url: t._raw.image_url || t.coverUrl || t.image_url || "",
              isrc: t._raw.isrc || t.isrc || null,
              spotify_url: t._raw.spotify_url || t.spotify_url || null,
              platform: t._raw.platform || t.platform || "spotify",
              source: t._raw.source || t.source || "spotify",
            };
          }
          return {
            ...t,
            song_title: t.song_title || t.song_name || t.title || t.name,
            song_name: t.song_name || t.song_title || t.title || t.name,
            artist: t.artist || "",
            image_url: t.image_url || t.coverUrl || "",
            preview_url: t.preview_url || t.audioUrl || "",
          };
        });

        // Soft re-rank: ưu tiên khớp title/artist — KHÔNG xóa list server
        const scored = normalized
          .map((t) => ({ t, s: scoreTitleMatch(q, t) }))
          .sort((a, b) => b.s - a.s)
          .map((x) => x.t);

        setResults(scored);
      } catch (e) {
        console.error("[search music]", e);
        SonnerError("Tìm nhạc lỗi", e?.message || "Thử lại sau");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, open, selected]);

  /** Chọn bài → vào màn cắt đoạn */
  const openClipEditor = async (track) => {
    if (!track || loading || pickingId) return;
    stopAudio();
    setClipLoading(true);
    setSelected(track);
    setStartTime(0);
    setPlayhead(0);
    setClipPlaying(false);

    const src = trackSrc(track);
    let metaDur = 30;
    if (Number(track.duration_ms) > 0) metaDur = Number(track.duration_ms) / 1000;
    else if (Number(track.duration) > 0) metaDur = Number(track.duration);
    // Preview web thường ~30s
    if (src && !track.musicTrackId && metaDur > 35) metaDur = 30;

    const playable = await loadPlayableDuration(src, Math.min(30, metaDur));
    const dur = Math.max(1, Math.min(playable, track.musicTrackId ? playable : 30));
    setPlayableDur(dur);
    playableRef.current = dur;

    // Chọn clipLen fit (ưu tiên 30, rồi 15)
    const best =
      CLIP_OPTIONS.filter((n) => n <= dur).sort((a, b) => b - a)[0] ||
      Math.min(30, Math.floor(dur));
    setClipLen(best);
    clipLenRef.current = best;
    setStartTime(0);
    setClipLoading(false);

    // Auto preview đoạn
    if (src) {
      try {
        if (!audioRef.current) audioRef.current = new Audio();
        const a = audioRef.current;
        a.src = src;
        a.currentTime = 0;
        await a.play();
        setClipPlaying(true);
        tickPlayhead();
      } catch {
        /* ignore autoplay block */
      }
    }
  };

  const tickPlayhead = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const loop = () => {
      const a = audioRef.current;
      if (!a || a.paused) {
        setClipPlaying(false);
        return;
      }
      const st = startTimeRef.current;
      const len = Math.min(clipLenRef.current, playableRef.current);
      const en = Math.min(playableRef.current, st + len);
      const t = a.currentTime;
      setPlayhead(t);
      if (t >= en - 0.05) {
        a.pause();
        a.currentTime = st;
        setPlayhead(st);
        setClipPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const toggleClipPlay = async () => {
    const src = trackSrc(selected);
    if (!src) {
      SonnerInfo("Bài này không có preview");
      return;
    }
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      const a = audioRef.current;
      if (!a.paused) {
        a.pause();
        setClipPlaying(false);
        return;
      }
      if (!a.src || !a.src.includes(String(src).slice(-20))) {
        a.src = src;
      }
      const st = startTimeRef.current;
      a.currentTime = st;
      await a.play();
      setClipPlaying(true);
      tickPlayhead();
    } catch {
      SonnerInfo("Không phát được");
    }
  };

  const chooseClipLen = (sec) => {
    const dur = playableRef.current;
    if (sec > dur + 0.5) {
      SonnerInfo(
        "Preview ngắn",
        `Chỉ còn ~${formatSec(dur)} — chọn ${CLIP_OPTIONS.filter((n) => n <= dur).join("/")}s`,
      );
      return;
    }
    const nextLen = Math.min(sec, dur);
    setClipLen(nextLen);
    clipLenRef.current = nextLen;
    setStartTime((s) => Math.min(s, Math.max(0, dur - nextLen)));
    stopAudio();
  };

  const onStartChange = (v) => {
    const dur = playableRef.current;
    const len = Math.min(clipLenRef.current, dur);
    const maxS = Math.max(0, dur - len);
    const next = Math.max(0, Math.min(Number(v) || 0, maxS));
    setStartTime(next);
    startTimeRef.current = next;
    setPlayhead(next);
    try {
      if (audioRef.current) audioRef.current.currentTime = next;
    } catch {
      /* ignore */
    }
  };

  /** Xác nhận gắn + clip */
  const confirmClip = async () => {
    if (!selected || loading) return;
    const id = selected.id || selected.spotify_url || selected.song_title || "pick";
    setPickingId(id);
    stopAudio();

    const src = trackSrc(selected);
    const len = Math.min(clipLen, playableDur);
    const s = Math.max(0, Math.min(startTime, Math.max(0, playableDur - len)));
    const e = Math.min(playableDur, s + len);

    try {
      await onPick?.({
        ...selected,
        preview_url: src || selected.preview_url || null,
        audioUrl: src || selected.audioUrl || null,
        startTime: s,
        endTime: e,
        volume: 1,
        originalVideoVolume: 1,
        duration: e - s,
        duration_ms: selected.duration_ms || playableDur * 1000,
      });
    } catch (err) {
      SonnerError("Gắn nhạc thất bại", err?.message || "");
    } finally {
      setPickingId(null);
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
            resolve(Number(a.duration) || 30);
            URL.revokeObjectURL(url);
          };
          a.onerror = () => {
            resolve(30);
            URL.revokeObjectURL(url);
          };
          a.src = url;
        } catch {
          resolve(30);
        }
      });
      const track = await uploadMusicTrack(file, {
        title: file.name.replace(/\.[^.]+$/, ""),
        duration,
      });
      SonnerSuccess("Đã tải nhạc");
      setLibrary((prev) => [track, ...prev]);
      await openClipEditor({
        id: track.id,
        song_title: track.title,
        song_name: track.title,
        name: track.title,
        artist: track.artist || "",
        image_url: track.coverUrl || "",
        preview_url: track.audioUrl,
        duration_ms: (track.duration || duration || 30) * 1000,
        duration: track.duration || duration || 30,
        source: "upload",
        musicTrackId: track.id,
        platform: "upload",
      });
    } catch (err) {
      SonnerError("Upload thất bại", err?.message || "");
    } finally {
      setUploading(false);
    }
  };

  const previewPlay = (track, e) => {
    e?.stopPropagation?.();
    const src = trackSrc(track);
    if (!src) {
      SonnerInfo("Bài này không có preview");
      return;
    }
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      const a = audioRef.current;
      if (!a.paused && a.src && a.src.includes(src.slice(-24))) {
        a.pause();
        return;
      }
      a.src = src;
      a.volume = 1;
      a.play().catch(() => SonnerInfo("Không phát được"));
    } catch {
      /* ignore */
    }
  };

  if (!showModal) return null;

  const busy = loading || Boolean(pickingId) || uploading;
  const maxStart = Math.max(0, playableDur - Math.min(clipLen, playableDur));
  const selLeft = playableDur > 0 ? (startTime / playableDur) * 100 : 0;
  const selWidth =
    playableDur > 0 ? (Math.min(clipLen, playableDur) / playableDur) * 100 : 100;
  const headPct = playableDur > 0 ? (playhead / playableDur) * 100 : 0;

  const titleOf = (t) =>
    t?.song_title || t?.song_name || t?.name || t?.title || "—";

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/40 backdrop-blur-[6px] transition-opacity duration-300 z-[99] text-base-content",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={!busy ? onClose : undefined}
    >
      <div
        className={clsx(
          "fixed border-t border-base-300 bottom-0 left-0 w-full max-h-[90vh] bg-base-100 rounded-t-4xl shadow-2xl transition-all duration-300 ease-out z-[100] flex flex-col",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          },
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-base-300" />
        </div>

        {/* ── CLIP EDITOR ── */}
        {selected ? (
          <>
            <div className="px-4 pb-2 flex items-center gap-2">
              <button
                type="button"
                className="p-2 rounded-full hover:bg-base-200"
                onClick={() => {
                  stopAudio();
                  setSelected(null);
                }}
                disabled={busy}
                aria-label="Quay lại"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold leading-tight">Cắt đoạn nhạc</h3>
                <p className="text-xs text-base-content/60 truncate">
                  Chọn đoạn phát trên Locket (preview ~30s)
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="p-2 rounded-full hover:bg-base-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 pb-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-base-300 shrink-0">
                  {selected.image_url || selected.coverUrl ? (
                    <img
                      src={selected.image_url || selected.coverUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music2 className="w-6 h-6 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{titleOf(selected)}</div>
                  <div className="text-xs text-base-content/60 truncate">
                    {selected.artist || ""}
                  </div>
                  <div className="text-xs text-primary mt-0.5">
                    {formatSec(startTime)} – {formatSec(endTime)} ·{" "}
                    {formatSec(endTime - startTime)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleClipPlay}
                  disabled={clipLoading || !trackSrc(selected)}
                  className="w-12 h-12 rounded-full bg-primary text-primary-content flex items-center justify-center shrink-0 disabled:opacity-40"
                >
                  {clipPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" />
                  )}
                </button>
              </div>

              {/* Clip length chips */}
              <div className="flex gap-2 flex-wrap">
                {CLIP_OPTIONS.map((sec) => {
                  const ok = sec <= playableDur + 0.25;
                  const active =
                    clipLen === sec ||
                    (clipLen > playableDur &&
                      sec ===
                        CLIP_OPTIONS.filter((n) => n <= playableDur).sort(
                          (a, b) => b - a,
                        )[0]);
                  return (
                    <button
                      key={sec}
                      type="button"
                      disabled={!ok || busy}
                      onClick={() => chooseClipLen(sec)}
                      className={clsx(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition",
                        active
                          ? "bg-primary text-primary-content border-primary"
                          : "bg-base-200 border-transparent opacity-80",
                        !ok && "opacity-30",
                      )}
                    >
                      {sec}s
                    </button>
                  );
                })}
                <span className="text-xs text-base-content/50 self-center ml-1">
                  file {formatSec(playableDur)}
                </span>
              </div>

              {/* Timeline */}
              <div className="relative h-10 rounded-xl bg-base-200 overflow-hidden select-none">
                <div
                  className="absolute top-0 bottom-0 bg-primary/35 border-x-2 border-primary"
                  style={{ left: `${selLeft}%`, width: `${selWidth}%` }}
                />
                {clipPlaying || playhead > startTime + 0.05 ? (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow"
                    style={{ left: `${headPct}%` }}
                  />
                ) : null}
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-base-content/60">
                  Bắt đầu: {formatSec(startTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={maxStart || 0}
                  step={0.1}
                  value={startTime}
                  onChange={(e) => onStartChange(e.target.value)}
                  className="range range-primary range-sm"
                  disabled={busy || maxStart <= 0}
                />
              </label>

              <button
                type="button"
                disabled={busy || clipLoading}
                onClick={confirmClip}
                className="btn btn-primary btn-lg rounded-3xl w-full"
              >
                {busy || pickingId ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang gắn…
                  </span>
                ) : (
                  `Gắn đoạn ${formatSec(endTime - startTime)}`
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ── SEARCH ── */}
            <div className="px-5 pb-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-red-500 to-cyan-400 flex items-center justify-center shadow-md shrink-0">
                <Music2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold leading-tight">Tìm nhạc</h3>
                <p className="text-xs text-base-content/60 truncate">
                  Tìm theo tên bài hoặc tên ca sĩ · chạm → cắt → gắn
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="p-2 rounded-full hover:bg-base-200"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 pb-2 flex gap-2">
              <label className="flex flex-1 items-center gap-2 bg-base-200 rounded-2xl px-3 py-2.5">
                <Search className="w-4 h-4 opacity-50 shrink-0" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tên bài hoặc ca sĩ (Sơn Tùng, Tìm Em...)"
                  className="bg-transparent outline-none w-full text-sm font-medium placeholder:text-base-content/40"
                  autoFocus
                  disabled={busy}
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
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="shrink-0 px-3 py-2.5 rounded-2xl bg-primary/15 text-primary text-xs font-semibold disabled:opacity-50"
              >
                {uploading ? "…" : "Tải lên"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4 min-h-[240px] max-h-[52vh]">
              {query.trim().length < 2 && library.length > 0 ? (
                <>
                  <p className="text-xs text-base-content/50 px-3 py-2">
                    Thư viện của bạn
                  </p>
                  {library.map((track) => (
                    <TrackRow
                      key={track.id}
                      title={track.title}
                      artist={track.artist || "Local"}
                      image={track.coverUrl}
                      meta={
                        track.duration ? formatSec(track.duration) : undefined
                      }
                      busy={busy}
                      picking={pickingId === track.id}
                      onPick={() =>
                        openClipEditor({
                          id: track.id,
                          song_title: track.title,
                          song_name: track.title,
                          name: track.title,
                          artist: track.artist,
                          image_url: track.coverUrl,
                          preview_url: track.audioUrl,
                          duration_ms: (track.duration || 0) * 1000,
                          duration: track.duration || 0,
                          source: track.source || "library",
                          musicTrackId: track.id,
                          platform: "upload",
                        })
                      }
                      onPreview={
                        track.audioUrl
                          ? (e) =>
                              previewPlay(
                                { preview_url: track.audioUrl },
                                e,
                              )
                          : null
                      }
                    />
                  ))}
                </>
              ) : query.trim().length < 2 ? (
                <p className="text-center text-sm text-base-content/50 py-12 px-4">
                  Gõ tên bài / ca sĩ — kết quả giống Spotify
                </p>
              ) : searching && !results.length ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin opacity-50" />
                </div>
              ) : !results.length ? (
                <p className="text-center text-sm text-base-content/50 py-12 px-4">
                  Không thấy bài khớp — thử đúng tên bài hơn
                </p>
              ) : (
                results.map((track) => {
                  const key = track.id || track.spotify_url || track.song_title;
                  return (
                    <TrackRow
                      key={key}
                      title={titleOf(track)}
                      artist={track.artist}
                      image={track.image_url}
                      meta={
                        track.duration_ms
                          ? formatMs(track.duration_ms)
                          : undefined
                      }
                      busy={busy}
                      picking={pickingId === key || pickingId === track.id}
                      onPick={() => openClipEditor(track)}
                      onPreview={
                        trackSrc(track)
                          ? (e) => previewPlay(track, e)
                          : null
                      }
                    />
                  );
                })
              )}
            </div>

            <div className="px-4 pb-5 pt-1 border-t border-base-200">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="btn btn-neutral btn-outline w-full rounded-3xl"
              >
                Hủy
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function TrackRow({
  title,
  artist,
  image,
  meta,
  onPick,
  onPreview,
  busy,
  picking,
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onPick}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition",
        "hover:bg-base-200 active:scale-[0.99]",
        busy && "opacity-60",
        picking && "bg-primary/10 ring-1 ring-primary/30",
      )}
    >
      <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-base-300">
        {image ? (
          <img
            src={image}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 className="w-5 h-5 opacity-40" />
          </div>
        )}
        {picking ? (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{title}</div>
        <div className="text-xs text-base-content/60 truncate">
          {artist}
          {meta ? ` · ${meta}` : ""}
        </div>
      </div>
      {onPreview ? (
        <span
          role="button"
          tabIndex={0}
          onClick={onPreview}
          onKeyDown={(e) => {
            if (e.key === "Enter") onPreview(e);
          }}
          className="text-xs font-semibold text-primary px-2.5 py-1 rounded-full bg-primary/10 shrink-0"
        >
          Nghe
        </span>
      ) : null}
    </button>
  );
}
