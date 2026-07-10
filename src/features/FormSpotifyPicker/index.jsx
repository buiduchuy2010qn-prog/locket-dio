import clsx from "clsx";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  Link2,
  Loader2,
  LogOut,
  Music2,
  RefreshCw,
  Search,
  Unplug,
} from "lucide-react";
import {
  clearSpotifyUserAuth,
  getSpotifyClientId,
  getSpotifyUserProfile,
  isSpotifyClientConfigured,
  isSpotifyUserLinked,
  startSpotifyUserLogin,
} from "@/utils/spotifyUserAuth";
import {
  getSpotifyCurrentlyPlaying,
  getSpotifyRecentlyPlayed,
  getSpotifyTopTracks,
  searchSpotifyTracks,
} from "@/services/ExtensionsServices/SpotifyUserServices";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";
import { useAuthStore } from "@/stores";
import { SonnerError, SonnerInfo } from "@/components/ui/SonnerToast";

function formatMs(ms = 0) {
  const s = Math.floor(Number(ms) / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Caption nhạc kiểu TikTok — chọn bài từ Spotify đã liên kết (search / đang phát / gần đây).
 */
export default function FormSpotifyPicker({
  open,
  onClose,
  onPick,
  loading = false,
}) {
  const user = useAuthStore((s) => s.user);
  const localId = getMyLocalId(user) || "guest";

  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [linked, setLinked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [results, setResults] = useState([]);
  const [recent, setRecent] = useState([]);
  const [top, setTop] = useState([]);
  const [current, setCurrent] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const searchTimer = useRef(null);
  const audioRef = useRef(null);

  const refreshLinkState = useCallback(() => {
    const ok = isSpotifyUserLinked(localId);
    setLinked(ok);
    setProfile(ok ? getSpotifyUserProfile(localId) : null);
    return ok;
  }, [localId]);

  const loadLists = useCallback(async () => {
    if (!isSpotifyUserLinked(localId)) return;
    setLoadingLists(true);
    try {
      const [cur, rec, tops] = await Promise.all([
        getSpotifyCurrentlyPlaying(localId).catch(() => null),
        getSpotifyRecentlyPlayed(localId, 18).catch(() => []),
        getSpotifyTopTracks(localId, 12).catch(() => []),
      ]);
      setCurrent(cur);
      setRecent(rec || []);
      setTop(tops || []);
    } catch (e) {
      if (e?.code === "SPOTIFY_UNAUTHORIZED" || e?.code === "SPOTIFY_NOT_LINKED") {
        clearSpotifyUserAuth(localId);
        setLinked(false);
        setProfile(null);
        SonnerInfo("Phiên Spotify hết hạn — hãy liên kết lại");
      } else {
        console.warn("[spotify picker]", e);
      }
    } finally {
      setLoadingLists(false);
    }
  }, [localId]);

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
      const ok = refreshLinkState();
      if (ok) loadLists();
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
  }, [open, refreshLinkState, loadLists]);

  useEffect(() => {
    if (!open || !linked) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const list = await searchSpotifyTracks(localId, q, 18);
        setResults(list);
      } catch (e) {
        if (e?.code === "SPOTIFY_NOT_LINKED") {
          setLinked(false);
        } else {
          SonnerError("Tìm nhạc lỗi", e?.message || "Thử lại");
        }
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 380);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, open, linked, localId]);

  const handleConnect = async () => {
    if (!isSpotifyClientConfigured()) {
      SonnerError(
        "Chưa cấu hình Spotify",
        "Thêm VITE_SPOTIFY_CLIENT_ID trên Render + Redirect URI: " +
          (typeof window !== "undefined"
            ? `${window.location.origin}/spotify/callback`
            : "/spotify/callback"),
      );
      return;
    }
    setConnecting(true);
    try {
      await startSpotifyUserLogin(localId);
    } catch (e) {
      setConnecting(false);
      SonnerError("Không mở được Spotify", e?.message || "Thử lại");
    }
  };

  const handleDisconnect = () => {
    clearSpotifyUserAuth(localId);
    setLinked(false);
    setProfile(null);
    setCurrent(null);
    setRecent([]);
    setTop([]);
    setResults([]);
    SonnerInfo("Đã ngắt liên kết Spotify");
  };

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

  const listToShow = query.trim()
    ? results
    : [...(current ? [current] : []), ...recent];

  const TrackRow = ({ track, badge }) => (
    <button
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
        <div className="font-semibold text-sm truncate flex items-center gap-1.5">
          {track.song_title || track.song_name}
          {badge ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/20 text-success font-bold shrink-0">
              {badge}
            </span>
          ) : null}
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              previewPlay(track);
            }
          }}
          className="text-xs font-semibold text-primary px-2 py-1 rounded-full bg-primary/10 shrink-0"
        >
          Nghe
        </span>
      ) : null}
    </button>
  );

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
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-base-300" />
        </div>

        {/* Header TikTok-style */}
        <div className="px-5 pb-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-red-500 to-cyan-400 flex items-center justify-center shadow-md shrink-0">
            <Music2 className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold leading-tight">Nhạc live · Spotify</h3>
            <p className="text-xs text-base-content/60 truncate">
              {linked && profile?.display_name
                ? `Đã liên kết: ${profile.display_name}`
                : "Kiểu TikTok — chọn nhạc trực tiếp từ Spotify của bạn"}
            </p>
          </div>
          {linked ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="btn btn-ghost btn-sm btn-circle"
              title="Ngắt liên kết"
            >
              <Unplug className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {!linked ? (
          <div className="px-5 pb-8 flex flex-col items-center gap-4">
            <p className="text-sm text-center text-base-content/70 max-w-sm">
              Liên kết Spotify để tìm bài, lấy bài đang phát / nghe gần đây và
              gắn caption nhạc lên Locket ngay trên web.
            </p>
            {!getSpotifyClientId() ? (
              <div className="text-xs text-warning bg-warning/10 rounded-2xl px-4 py-3 max-w-sm text-center">
                Admin cần set <code className="font-mono">VITE_SPOTIFY_CLIENT_ID</code>{" "}
                và Redirect URI{" "}
                <code className="font-mono text-[10px] break-all">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/spotify/callback`
                    : "/spotify/callback"}
                </code>{" "}
                trên Spotify Developer Dashboard.
              </div>
            ) : null}
            <button
              type="button"
              disabled={connecting}
              onClick={handleConnect}
              className="btn btn-success btn-lg rounded-3xl gap-2 min-w-[220px]"
            >
              {connecting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Link2 className="w-5 h-5" />
              )}
              Liên kết Spotify
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost rounded-3xl"
            >
              Đóng
            </button>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="px-4 pb-2">
              <label className="flex items-center gap-2 bg-base-200 rounded-2xl px-3 py-2.5">
                <Search className="w-4 h-4 opacity-50 shrink-0" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm bài hát, nghệ sĩ..."
                  className="bg-transparent outline-none w-full text-sm font-medium placeholder:text-base-content/40"
                  autoFocus
                />
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin opacity-60" />
                ) : null}
              </label>
            </div>

            <div className="flex items-center justify-between px-5 py-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
                {query.trim()
                  ? "Kết quả"
                  : current
                    ? "Đang phát & gần đây"
                    : "Nghe gần đây"}
              </span>
              <button
                type="button"
                onClick={loadLists}
                disabled={loadingLists}
                className="btn btn-ghost btn-xs gap-1"
              >
                <RefreshCw
                  className={clsx("w-3.5 h-3.5", loadingLists && "animate-spin")}
                />
                Làm mới
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4 min-h-[240px] max-h-[52vh]">
              {loadingLists && !listToShow.length ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin opacity-50" />
                </div>
              ) : null}

              {!query.trim() && current ? (
                <div className="mb-1">
                  <TrackRow track={current} badge="Đang phát" />
                </div>
              ) : null}

              {!query.trim() && top.length > 0 && !current ? (
                <div className="mb-2">
                  <p className="px-3 text-[11px] font-bold text-base-content/40 uppercase mb-1">
                    Top của bạn
                  </p>
                  {top.slice(0, 6).map((t) => (
                    <TrackRow key={`top-${t.id}`} track={t} />
                  ))}
                </div>
              ) : null}

              {listToShow.length === 0 && !loadingLists && !searching ? (
                <p className="text-center text-sm text-base-content/50 py-8 px-4">
                  {query.trim()
                    ? "Không tìm thấy bài hát"
                    : "Chưa có lịch sử — tìm kiếm hoặc bật nhạc trên Spotify rồi làm mới"}
                </p>
              ) : (
                (query.trim() ? results : recent).map((t) => (
                  <TrackRow key={`${query ? "s" : "r"}-${t.id}`} track={t} />
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
