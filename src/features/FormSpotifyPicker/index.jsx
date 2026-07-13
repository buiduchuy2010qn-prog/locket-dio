import clsx from "clsx";
import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import { Loader2, Music2, Search, Play, Pause, ChevronLeft } from "lucide-react";
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

function trackDurationSec(track) {
  if (!track) return 30;
  if (track.duration_ms > 0) return track.duration_ms / 1000;
  if (track.duration > 0) return Number(track.duration);
  // Spotify preview thường ~30s
  if (track.preview_url) return 30;
  return 30;
}

/**
 * Tìm nhạc + chọn đoạn phát (start/end/volume) trước khi gắn caption.
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

  // Clip editor step
  const [selected, setSelected] = useState(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(30);
  const [volume, setVolume] = useState(1);
  const [originalVideoVolume, setOriginalVideoVolume] = useState(0.3);
  const [clipPlaying, setClipPlaying] = useState(false);
  const [clipPos, setClipPos] = useState(0);

  const searchTimer = useRef(null);
  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const stopAudio = useCallback(() => {
    try {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
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

  // Clip preview loop within start/end
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !selected) return;

    const onTime = () => {
      setClipPos(a.currentTime);
      if (a.currentTime >= endTime - 0.05) {
        a.currentTime = startTime;
        if (!a.paused) a.play().catch(() => {});
      }
    };
    a.addEventListener("timeupdate", onTime);
    return () => a.removeEventListener("timeupdate", onTime);
  }, [selected, startTime, endTime]);

  const openClipEditor = (track) => {
    if (!track || loading) return;
    stopAudio();
    const dur = trackDurationSec(track);
    // Mặc định đoạn 15s đầu (hoặc full nếu ngắn hơn)
    const defEnd = Math.min(dur, Math.max(15, Math.min(30, dur)));
    setSelected(track);
    setStartTime(0);
    setEndTime(defEnd > 0 ? defEnd : dur);
    setVolume(1);
    setOriginalVideoVolume(0.3);
    setClipPos(0);
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
      openClipEditor({
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
      SonnerInfo("Không có audio để nghe thử đoạn");
      return;
    }
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      const a = audioRef.current;
      a.volume = volume;
      if (a.src !== src) {
        a.src = src;
        a.load();
      }
      if (!a.paused && clipPlaying) {
        a.pause();
        setClipPlaying(false);
        return;
      }
      a.currentTime = startTime;
      await a.play();
      setClipPlaying(true);
    } catch {
      setClipPlaying(false);
      SonnerInfo("Không phát được — chạm lại để thử");
    }
  };

  const confirmClip = () => {
    if (!selected || loading) return;
    stopAudio();
    const dur = trackDurationSec(selected);
    let s = Math.max(0, Math.min(startTime, dur));
    let e = Math.max(s + 0.5, Math.min(endTime, dur || endTime));
    if (e <= s) e = Math.min(dur, s + 15);

    onPick?.({
      ...selected,
      startTime: s,
      endTime: e,
      volume,
      originalVideoVolume,
      duration: dur,
      duration_ms: (selected.duration_ms || dur * 1000),
    });
  };

  const backToList = () => {
    stopAudio();
    setSelected(null);
  };

  if (!showModal) return null;

  const dur = selected ? trackDurationSec(selected) : 30;
  const maxT = Math.max(dur, endTime, 1);

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
          "fixed border-t border-base-300 bottom-0 left-0 w-full max-h-[90vh] bg-base-100 rounded-t-4xl shadow-2xl transition-all duration-400 ease-out z-[100] flex flex-col",
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
                onClick={backToList}
                className="p-2 rounded-full hover:bg-base-200"
                aria-label="Quay lại"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold truncate">
                  Chọn đoạn nhạc
                </h3>
                <p className="text-xs text-base-content/60 truncate">
                  {selected.song_title || selected.song_name || selected.name}
                  {selected.artist ? ` · ${selected.artist}` : ""}
                </p>
              </div>
            </div>

            <div className="px-5 pb-4 flex flex-col gap-4 overflow-y-auto">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-base-300 shrink-0">
                  {selected.image_url ? (
                    <img
                      src={selected.image_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music2 className="w-6 h-6 opacity-40" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={toggleClipPreview}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-content text-sm font-semibold"
                >
                  {clipPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {clipPlaying ? "Dừng" : "Nghe đoạn"}
                </button>
                <span className="text-xs text-base-content/50 tabular-nums">
                  {formatSec(clipPos)} / {formatSec(maxT)}
                </span>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">
                  Bắt đầu: {formatSec(startTime)}
                </legend>
                <input
                  type="range"
                  min={0}
                  max={maxT}
                  step={0.1}
                  value={startTime}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setStartTime(v);
                    if (v >= endTime - 0.5) setEndTime(Math.min(maxT, v + 1));
                  }}
                  className="range range-primary range-sm w-full"
                  aria-label="Thời điểm bắt đầu"
                />
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">
                  Kết thúc: {formatSec(endTime)}
                </legend>
                <input
                  type="range"
                  min={0}
                  max={maxT}
                  step={0.1}
                  value={endTime}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setEndTime(v);
                    if (v <= startTime + 0.5)
                      setStartTime(Math.max(0, v - 1));
                  }}
                  className="range range-primary range-sm w-full"
                  aria-label="Thời điểm kết thúc"
                />
              </fieldset>

              <p className="text-xs text-base-content/50">
                Đoạn phát: {formatSec(startTime)} → {formatSec(endTime)} (
                {formatSec(Math.max(0, endTime - startTime))})
              </p>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">
                  Âm lượng nhạc: {Math.round(volume * 100)}%
                </legend>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v;
                  }}
                  className="range range-sm w-full"
                  aria-label="Âm lượng nhạc"
                />
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">
                  Âm lượng video gốc: {Math.round(originalVideoVolume * 100)}%
                </legend>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={originalVideoVolume}
                  onChange={(e) =>
                    setOriginalVideoVolume(Number(e.target.value))
                  }
                  className="range range-sm w-full"
                  aria-label="Âm lượng video gốc"
                />
                <p className="text-[11px] text-base-content/45">
                  Dùng khi moment là video — giảm tiếng video để nhạc rõ hơn
                </p>
              </fieldset>
            </div>

            <div className="px-4 pb-5 pt-2 border-t border-base-200 flex gap-2">
              <button
                type="button"
                onClick={backToList}
                disabled={loading}
                className="btn btn-neutral btn-outline flex-1 rounded-3xl"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={confirmClip}
                disabled={loading}
                className="btn btn-primary flex-1 rounded-3xl gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Dùng đoạn này
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ── SEARCH LIST ── */}
            <div className="px-5 pb-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-red-500 to-cyan-400 flex items-center justify-center shadow-md shrink-0">
                <Music2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold leading-tight">Tìm nhạc</h3>
                <p className="text-xs text-base-content/60 truncate">
                  Chọn bài → chỉnh đoạn phát → gắn caption
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
