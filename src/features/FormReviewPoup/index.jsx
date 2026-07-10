import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { RiDoubleQuotesL, RiDoubleQuotesR } from "react-icons/ri";
import { StarProgress } from "@/components/ui/StarRating/StarProgress";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

const FormReviewPoup = ({
  open,
  onClose,
  onConfirm,
  title,
  loading = false,
  loadingText,
}) => {
  const { t } = useTranslation("features");
  const resolvedTitle = title ?? t("form_review_poup.title");
  const resolvedLoadingText = loadingText ?? t("form_review_poup.loading_text");
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

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
      setTimeout(() => {
        setShowModal(false);
        setRating(5);
        setText("");
      }, 300);
    }
  }, [open]);

  if (!showModal) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm?.({ rating, text });
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
          "fixed border-t border-base-300 bottom-0 left-0 w-full pt-6 pb-6 px-5 bg-base-100 rounded-t-4xl shadow-lg transition-all duration-500 ease-in-out z-[100] flex flex-col text-base-content",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          }
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold text-center mb-2">{resolvedTitle}</h3>
        <div className="w-full flex justify-center">
          <div className="bg-black/10 backdrop-blur-sm rounded-2xl px-6 flex flex-col items-center justify-center font-semibold max-w-[90vw] w-max">
            {/* Stars */}
            <div className="flex justify-center py-2 gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <StarProgress
                  key={star}
                  size={23}
                  fillPercent={Math.min(
                    100,
                    Math.max(0, (rating - (star - 1)) * 100),
                  )}
                />
              ))}
            </div>

            {text && (
              <div className="relative text-center max-w-full px-5 pb-2">
                <RiDoubleQuotesL
                  size={16}
                  className="absolute -left-1 opacity-80"
                />
                <RiDoubleQuotesR
                  size={16}
                  className="absolute -right-1 opacity-80"
                />

                <p className="text-lg font-semibold break-words whitespace-pre-wrap leading-snug">
                  {text}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ===== RATING CONTROL ===== */}
        <div className="my-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="opacity-70">{t("form_review_poup.drag_stars")}</span>
            <span className="font-medium">{rating.toFixed(1)}/5</span>
          </div>

          <input
            type="range"
            min={0}
            max={5}
            step={0.1}
            value={rating}
            onChange={(e) => setRating(parseFloat(e.target.value))}
            className="range range-sm w-full"
          />
        </div>

        {/* ===== CAPTION INPUT ===== */}
        <div className="mb-6">
          <label className="text-sm opacity-70 block mb-2">
            {t("form_review_poup.enter_caption")}
          </label>

          <input
            value={text}
            onChange={(e) =>
              e.target.value.length <= 50 && setText(e.target.value)
            }
            placeholder={t("form_review_poup.max_chars_placeholder")}
            className="input input-ghost text-base bg-base-300 py-6 rounded-3xl w-full shadow-md placeholder:text-base-content/50 placeholder:italic font-semibold pl-4"
          />
        </div>

        <div className="flex justify-center flex-col sm:flex-row gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn btn-warning btn-lg rounded-3xl w-full sm:w-auto sm:min-w-[140px]"
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                {resolvedLoadingText}
              </>
            ) : (
              t("form_review_poup.confirm_btn")
            )}
          </button>

          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-neutral btn-outline btn-lg rounded-3xl w-full sm:w-auto sm:min-w-[140px]"
          >
            {t("form_review_poup.cancel_btn")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default FormReviewPoup;
