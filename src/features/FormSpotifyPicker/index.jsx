import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Loader2, Music2, Search } from "lucide-react";
import { searchMusicByQuery } from "@/services/ExtensionsServices/MusicServices";
import {
  listMusicTracks,
  searchMusicLibrary,
  uploadMusicTrack,
  toLocketMusicOptions,
} from "@/services/ExtensionsServices/MusicLibraryServices";
import { SonnerError, SonnerInfo, SonnerSuccess } from "@/components/ui/SonnerToast";

function formatMs(ms = 0) {
  const s = Math.floor(Number(ms) / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Tìm nhạc & gắn caption — full Spotify catalog (không cần liên kết account).
 * Search qua API server (Spotify Web API + fallback Deezer/iTunes).
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
  const searchTimer = useRef(null);
  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

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
      try {
        audioRef.current?.pause();
      } catch {
        /* ignore */
      }
    }
  }, [open]);

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
        // Prefer unified library search (local + Spotify full)
        let list = [];
        try {
          list = await searchMusicLibrary(q, 40);
        } catch {
          list = await searchMusicByQuery(q, 40);
        }
        // Normalize library rows to track shape used by onPick
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

  const handlePick = (track) => {
    if (!track || loading) return;
    try {
      audioRef.current?.pause();
    } catch {
      /* ignore */
    }
    // Library upload track without spotify — still attach
    onPick?.(track);
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
      // Auto-pick uploaded track for caption
      const pickable = {
        id: track.id,
        song_title: track.title,
        song_name: track.title,
        name: track.title,
        artist: track.artist || "",
        image_url: track.coverUrl || "",
        preview_url: track.audioUrl,
        duration_ms: (track.duration || 0) * 1000,
        source: "upload",
        musicTrackId: track.id,
        platform: "upload",
        startTime: 0,
        endTime: track.duration || 0,
        volume: 1,
        originalVideoVolume: 1,
      };
      onPick?.(pickable);
    } catch (err) {
      SonnerError("Upload nhạc thất bại", err?.message || "");
    } finally {
      setUploading(false);
    }
  };

  const previewPlay = (track) => {
    if (!track?.preview_url) {
      SonnerInfo("Bài này không có preview 30s");
      return;
    }
    try {
      if (!audioRef.current) audioRef.current = new Audio();
      const a = audioRef.current;
      if (a.src === track.preview_url && !a.paused) {
        a.pause();
        return;
      }
      a.src = track.preview_url;
      a.play().catch(() => {});
    } catch {
      /* ignore */
    }
  };

  if (!showModal) return null;

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/40 backdrop-blur-[6px] transition-opacity duration-400 z-[99] text-base-content",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={!loading ? onClose : undefined}
    >
      <div
        className={clsx(
          "fixed border-t border-base-300 bottom-0 left-0 w-full max-h-[88vh] bg-base-100 rounded-t-4xl shadow-2xl transition-all duration-400 ease-out z-[100] flex flex-col",
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
              Tìm full trên Spotify — gõ tên bài / nghệ sĩ, chọn xong gắn caption
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
                    handlePick({
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
                onClick={() => handlePick(track)}
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
      </div>
    </div>,
    document.body,
  );
}
