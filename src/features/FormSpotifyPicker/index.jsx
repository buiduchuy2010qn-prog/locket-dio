import clsx from "clsx";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Loader2, Music2, Search } from "lucide-react";
import { searchMusicByQuery } from "@/services/ExtensionsServices/MusicServices";
import { SonnerError, SonnerInfo } from "@/components/ui/SonnerToast";

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
  const searchTimer = useRef(null);
  const audioRef = useRef(null);
  const inputRef = useRef(null);

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
        const list = await searchMusicByQuery(q, 40);
        setResults(Array.isArray(list) ? list : []);
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
    onPick?.(track);
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

        <div className="px-4 pb-2">
          <label className="flex items-center gap-2 bg-base-200 rounded-2xl px-3 py-2.5">
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
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3 min-h-[220px] max-h-[50vh]">
          {query.trim().length < 2 ? (
            <p className="text-center text-sm text-base-content/50 py-10 px-4">
              Nhập ít nhất 2 ký tự để tìm bài hát
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
