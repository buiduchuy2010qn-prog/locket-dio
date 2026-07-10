import clsx from "clsx";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";

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
    }
  }, [open]);

  if (!showModal) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!musicLink.trim()) return;
    onConfirm?.(musicLink.trim());
  };

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[99] text-base-content",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        }
      )}
      onClick={!loading ? onClose : undefined}
    >
      <div
        className={clsx(
          "fixed border-t border-base-300 bottom-0 left-0 w-full pt-6 pb-6 px-5 bg-base-100 rounded-t-4xl shadow-lg transition-all duration-500 ease-in-out z-[100] flex flex-col",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          }
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {icon && (
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 flex items-center justify-center rounded-full bg-amber-300 shadow-md">
              {icon}
            </div>
          </div>
        )}

        <h3 className="text-xl font-semibold text-center mb-2">{title}</h3>

        <p className="text-sm text-center text-base-content/70 mb-4">
          {t("form_music_poup.ios_only_note")}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={musicLink}
            onChange={(e) => setMusicLink(e.target.value)}
            placeholder={
              formType === "apple"
                ? "https://music.apple.com/..."
                : "https://open.spotify.com/track/..."
            }
            className="input input-ghost text-base bg-base-300 py-6 rounded-3xl w-full shadow-md placeholder:text-base-content/50 placeholder:italic font-semibold pl-4"
            required
          />

          <div className="flex justify-center flex-col sm:flex-row gap-3 mt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-warning btn-lg rounded-3xl w-full sm:w-auto sm:min-w-[140px]"
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
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
