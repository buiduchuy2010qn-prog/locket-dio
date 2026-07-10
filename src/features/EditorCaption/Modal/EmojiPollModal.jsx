import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import {
  RECOMMENDED_EMOJIS,
  POPULAR_EMOJIS,
  EMOJI_GRID,
  EMOJI_PAIRS,
} from "@/constants";
import clsx from "clsx";

const sections = [
  {
    title: "⭐ Đề xuất",
    emojis: RECOMMENDED_EMOJIS,
  },
  {
    title: "🔥 Phổ biến",
    emojis: POPULAR_EMOJIS,
  },
  {
    title: "😀 Tất cả",
    emojis: EMOJI_GRID,
  },
];

function EmojiModal({
  open,
  onClose,
  setPostOverlay,
  activeSide,
  title = "Chọn emoji",
}) {
  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [tab, setTab] = useState("pair");

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
    } else {
      setAnimate(false);
      setTimeout(() => setShowModal(false), 300);
    }
  }, [open]);

  if (!showModal) return null;

  const updatePair = (pair) => {
    setPostOverlay({
      payload: {
        left_emoji: pair.left,
        right_emoji: pair.right,
      },
    });

    onClose();
  };

  const updateSingle = (emoji) => {
    if (!activeSide) return;

    setPostOverlay({
      payload: {
        [activeSide === "left" ? "left_emoji" : "right_emoji"]: emoji,
      },
    });

    onClose();
  };

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
        <div className="p-4 pb-0 flex flex-col h-full">
          <h3 className="text-xl font-semibold text-center mb-4">{title}</h3>

          <div className="flex justify-center gap-2 mb-5">
            <button
              onClick={() => setTab("pair")}
              className={clsx("btn btn-sm rounded-full", {
                "btn-primary": tab === "pair",
                "btn-ghost": tab !== "pair",
              })}
            >
              Gợi ý cặp
            </button>

            <button
              onClick={() => setTab("single")}
              className={clsx("btn btn-sm rounded-full", {
                "btn-primary": tab === "single",
                "btn-ghost": tab !== "single",
              })}
            >
              Chỉnh lẻ
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {tab === "pair" && (
              <div className="grid grid-cols-2 gap-3">
                {EMOJI_PAIRS.map((pair, idx) => (
                  <button
                    key={idx}
                    onClick={() => updatePair(pair)}
                    className="flex items-center justify-center gap-4 p-4 rounded-2xl bg-base-200 hover:bg-base-300 transition"
                  >
                    <span className="text-3xl">{pair.left}</span>
                    <span className="text-3xl">{pair.right}</span>
                  </button>
                ))}
              </div>
            )}

            {tab === "single" && (
              <div className="flex-1 overflow-y-auto">
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
                          )}
                          onClick={() => updateSingle(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default EmojiModal;
