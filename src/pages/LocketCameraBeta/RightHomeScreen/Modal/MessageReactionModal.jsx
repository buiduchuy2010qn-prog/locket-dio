import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import clsx from "clsx";
import { RECOMMENDED_EMOJIS, POPULAR_EMOJIS, EMOJI_GRID } from "@/constants";
import { useTranslation } from "react-i18next";

const MessageReactionModal = ({ open, onClose, myReaction, onReaction }) => {
  const { t } = useTranslation("main");
  const sections = [
    {
      title: t("right.recommended"),
      emojis: RECOMMENDED_EMOJIS,
    },
    {
      title: t("right.popular"),
      emojis: POPULAR_EMOJIS,
    },
    {
      title: t("right.all"),
      emojis: EMOJI_GRID,
    },
  ];

  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);

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
    }
  }, [open]);

  if (!showModal) return null;

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[62]",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={onClose}
    >
      <div
        className={clsx(
          "fixed h-2/3 border-t border-base-300 bottom-0 left-0 w-full bg-base-100 rounded-t-4xl shadow-lg transition-all duration-500 ease-in-out z-[63] flex flex-col text-base-content overflow-hidden",
          {
            "translate-y-0": animate,
            "translate-y-full": !animate,
          },
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-base-300" />
        </div>

        <h3 className="text-sm font-bold text-center mb-3 shrink-0 text-base-content/70">
          {t("right.choose_emoji")}
        </h3>

        <div className="flex-1 px-4 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.title} className="mb-6">
              <h4 className="py-2 text-sm font-semibold text-base-content/60">
                {section.title}
              </h4>

              <div className="grid grid-cols-6 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-18 gap-2 select-none">
                {section.emojis.map((emoji) => (
                  <button
                    key={`${section.title}-${emoji}`}
                    className={clsx(
                      "aspect-square flex items-center justify-center text-5xl rounded-xl hover:bg-base-200 transition-all",
                      // {
                      //   "bg-primary/20 ring-2 ring-primary":
                      //     myReaction === emoji,
                      // },
                    )}
                    onClick={() => onReaction(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MessageReactionModal;
