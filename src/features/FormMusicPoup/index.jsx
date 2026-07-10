import clsx from "clsx";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import { Link2, Music2 } from "lucide-react";

/** oEmbed client — title + cover siêu nhanh khi dán link track */
async function fetchSpotifyOembedClient(url) {
  try {
    const u = new URL("https://open.spotify.com/oembed");
    u.searchParams.set("url", url);
    const res = await fetch(u.toString());
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.title) return null;
    let song_name = data.title;
    let artist = "";
    if (song_name.includes(" · ")) {
      const parts = song_name.split(" · ");
      song_name = parts[0].trim();
      artist = (parts[1] || "").trim();
    }
    return {
      song_name,
      artist,
      image_url: data.thumbnail_url || "",
      title: [song_name, artist].filter(Boolean).join(" - "),
    };
  } catch {
    return null;
  }
}

function isSpotifyTrackUrl(s) {
  return /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/|spotify:track:/i.test(
    s || "",
  );
}

const FormMusicPoup = ({
  open,
  onClose,
  title,
  onConfirm,
  loading = false,
  loadingText,
  icon,
  formType = "spotify",
}) => {
  const { t } = useTranslation("features");
  const resolvedLoadingText = loadingText ?? t("form_music_poup.loading_text");
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [musicLink, setMusicLink] = useState("");
  const [oembedPreview, setOembedPreview] = useState(null);
  const [oembedLoading, setOembedLoading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = showModal ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [showModal]);

  useEffect(() => {
    if (open) {
      setShowModal(true);
      setTimeout(() => setAnimate(true), 10);
    } else {
      setAnimate(false);
      setTimeout(() => setShowModal(false), 300);
      setMusicLink("");
      setOembedPreview(null);
    }
  }, [open]);

  // Spotify: dán link track → oEmbed instant (title + cover)
  useEffect(() => {
    if (formType !== "spotify") return;
    const link = musicLink.trim();
    if (!link || !isSpotifyTrackUrl(link)) {
      setOembedPreview(null);
      return;
    }
    let cancelled = false;
    setOembedLoading(true);
    const tmr = setTimeout(async () => {
      const meta = await fetchSpotifyOembedClient(link);
      if (!cancelled) {
        setOembedPreview(meta);
        setOembedLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(tmr);
    };
  }, [musicLink, formType]);

  if (!showModal) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!musicLink.trim()) return;
    onConfirm?.(musicLink.trim());
  };

  const isSpotify = formType === "spotify";

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[99] text-base-content",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={!loading ? onClose : undefined}
    >
      <div
        className={clsx(
          "fixed border-t border-base-300 bottom-0 left-0 w-full pt-5 pb-6 px-5 bg-base-100 rounded-t-4xl shadow-lg transition-all duration-500 ease-in-out z-[100] flex flex-col max-h-[90vh]",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          },
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-2">
          <div className="w-10 h-1 rounded-full bg-base-300" />
        </div>

        {icon && (
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-success/20 shadow-md">
              {icon}
            </div>
          </div>
        )}

        <h3 className="text-xl font-semibold text-center mb-1">
          {title || (isSpotify ? "Spotify · dán link track" : "Apple Music")}
        </h3>

        {isSpotify ? (
          <div className="text-xs text-center text-base-content/65 mb-3 space-y-1 px-2">
            <p className="font-medium text-base-content/80">
              Cách nhanh nhất: mở Spotify → Share → Copy link track → dán vào đây
            </p>
            <p className="opacity-80">
              oEmbed lấy tên + ảnh ngay · API gắn ISRC + preview cho Locket
            </p>
          </div>
        ) : (
          <p className="text-sm text-center text-base-content/70 mb-4">
            {t("form_music_poup.ios_only_note")}
          </p>
        )}

        {/* Instant oEmbed preview */}
        {isSpotify && (oembedPreview || oembedLoading) && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-base-200 px-3 py-2.5">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-base-300 shrink-0">
              {oembedPreview?.image_url ? (
                <img
                  src={oembedPreview.image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music2 className="w-5 h-5 opacity-40" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              {oembedLoading && !oembedPreview ? (
                <span className="text-sm opacity-60">Đang lấy meta…</span>
              ) : (
                <>
                  <div className="font-semibold text-sm truncate">
                    {oembedPreview?.song_name}
                  </div>
                  {oembedPreview?.artist ? (
                    <div className="text-xs text-base-content/60 truncate">
                      {oembedPreview.artist}
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <Link2 className="w-4 h-4 opacity-40 shrink-0" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCorrect="off"
            value={musicLink}
            onChange={(e) => setMusicLink(e.target.value)}
            placeholder={
              isSpotify
                ? "https://open.spotify.com/track/..."
                : "https://music.apple.com/..."
            }
            className="input input-ghost text-base bg-base-300 py-6 rounded-3xl w-full shadow-md placeholder:text-base-content/50 placeholder:italic font-semibold pl-4"
            required
          />

          {isSpotify && musicLink.trim() && !isSpotifyTrackUrl(musicLink) ? (
            <p className="text-xs text-warning -mt-2 px-1">
              Cần link track (…/track/…), không dùng playlist/album/artist.
            </p>
          ) : null}

          <div className="flex justify-center flex-col sm:flex-row gap-3 mt-1">
            <button
              type="submit"
              disabled={
                loading ||
                (isSpotify &&
                  musicLink.trim() &&
                  !isSpotifyTrackUrl(musicLink))
              }
              className="btn btn-success btn-lg rounded-3xl w-full sm:w-auto sm:min-w-[140px]"
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  {resolvedLoadingText}
                </>
              ) : (
                t("form_music_poup.send_btn")
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-neutral btn-outline btn-lg rounded-3xl w-full sm:w-auto sm:min-w-[140px]"
            >
              {t("form_music_poup.cancel_btn")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default FormMusicPoup;
