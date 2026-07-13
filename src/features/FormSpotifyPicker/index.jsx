import clsx from "clsx";
import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import { Loader2, Music2, Search, X } from "lucide-react";
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
  return (
    track?.preview_url ||
    track?.audioUrl ||
    track?.audio_url ||
    track?.audio ||
    ""
  );
}

/**
 * Tìm nhạc siêu nhanh: gõ → chọn bài → gắn ngay.
 * Không màn cắt 30/45/60 (preview web chỉ ~30s, UI thừa).
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

  const searchTimer = useRef(null);
  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const stopAudio = useCallback(() => {
    try {
      audioRef.current?.pause();
    } catch {
      /* ignore */
    }
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
          // Library API wraps Spotify hit in _raw — merge for isrc/spotify_url
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
              image_url:
                t._raw.image_url || t.coverUrl || t.image_url || "",
              isrc: t._raw.isrc || t.isrc || null,
              spotify_url: t._raw.spotify_url || t.spotify_url || null,
              platform: t._raw.platform || t.platform || "spotify",
              source: t._raw.source || t.source || "spotify",
            };
          }
          if (t.song_title || t.song_name || t.preview_url || t.isrc) {
            return t;
          }
          return {
            id: t.id,
            song_title: t.title,
            song_name: t.title,
            name: t.title,
            artist: t.artist,
            image_url: t.coverUrl || t.cover_url || "",
            preview_url: t.preview_url || t.audioUrl || "",
            duration_ms: (t.duration || 0) * 1000,
            duration: t.duration || 0,
            spotify_url: t.spotify_url || null,
            isrc: t.isrc || null,
            source: t.source || "library",
            musicTrackId: t.id,
            platform: t.platform || t.source || "upload",
          };
        });
        // Ưu tiên bài có ISRC (Locket app bắt buộc) lên đầu
        normalized.sort((a, b) => {
          const ai = a.isrc ? 1 : 0;
          const bi = b.isrc ? 1 : 0;
          if (bi !== ai) return bi - ai;
          const as = a.spotify_url ? 1 : 0;
          const bs = b.spotify_url ? 1 : 0;
          return bs - as;
        });
        setResults(normalized);
      } catch (e) {
        SonnerError("Tìm nhạc lỗi", e?.message || "Thử lại sau");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, open]);

  /** Gắn ngay — start 0, end = preview ~30s hoặc full upload */
  const pickTrack = async (track) => {
    if (!track || loading || pickingId) return;
    const id = track.id || track.spotify_url || track.song_title || "pick";
    setPickingId(id);
    stopAudio();

    const src = trackSrc(track);
    let dur = 30;
    if (Number(track.duration_ms) > 0) dur = Number(track.duration_ms) / 1000;
    else if (Number(track.duration) > 0) dur = Number(track.duration);
    // Web preview Spotify thường ~30s
    if (src && !track.musicTrackId && dur > 35) dur = 30;

    try {
      await onPick?.({
        ...track,
        preview_url: src || track.preview_url || null,
        audioUrl: src || track.audioUrl || null,
        startTime: 0,
        endTime: Math.max(1, Math.min(dur, 600)),
        volume: 1,
        originalVideoVolume: 1,
        duration: dur,
        duration_ms: track.duration_ms || dur * 1000,
      });
    } catch (e) {
      SonnerError("Gắn nhạc thất bại", e?.message || "");
    } finally {
      // Parent có thể fail soft (thiếu ISRC) — luôn mở lại chọn
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
      await pickTrack({
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
          "fixed border-t border-base-300 bottom-0 left-0 w-full max-h-[88vh] bg-base-100 rounded-t-4xl shadow-2xl transition-all duration-300 ease-out z-[100] flex flex-col",
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

        <div className="px-5 pb-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-red-500 to-cyan-400 flex items-center justify-center shadow-md shrink-0">
            <Music2 className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold leading-tight">Tìm nhạc</h3>
            <p className="text-xs text-base-content/60 truncate">
              Chạm bài → gắn caption ngay
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
              placeholder="Sơn Tùng, Blinding Lights..."
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
                  picking={
                    pickingId === track.id
                  }
                  onPick={() =>
                    pickTrack({
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
              Gõ tên bài / ca sĩ để tìm — chạm là gắn
            </p>
          ) : searching && !results.length ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin opacity-50" />
            </div>
          ) : !results.length ? (
            <p className="text-center text-sm text-base-content/50 py-12 px-4">
              Không thấy — thử từ khóa khác
            </p>
          ) : (
            results.map((track) => {
              const key = track.id || track.spotify_url || track.song_title;
              return (
                <TrackRow
                  key={key}
                  title={
                    track.song_title || track.song_name || track.name || "—"
                  }
                  artist={track.artist}
                  image={track.image_url}
                  meta={
                    track.duration_ms
                      ? formatMs(track.duration_ms)
                      : undefined
                  }
                  busy={busy}
                  picking={pickingId === key || pickingId === track.id}
                  onPick={() => pickTrack(track)}
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
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang gắn...
              </span>
            ) : (
              "Hủy"
            )}
          </button>
        </div>
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
