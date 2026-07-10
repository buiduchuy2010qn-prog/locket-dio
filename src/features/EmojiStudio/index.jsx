import React, { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import ReactDOM from "react-dom";
import { Laugh, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SendReactMoment } from "@/services";
import PlanBadge from "@/components/ui/PlanBadge/PlanBadge";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";
import { useReactionStore, useSelectedStore } from "@/stores";
import { EMOJI_GRID, POPULAR_EMOJIS } from "@/constants";

const EmojiPicker = ({ open, onClose }) => {
  const { t } = useTranslation("features");
  const selectedMomentId = useSelectedStore((s) => s.selectedMomentId);
  const triggerReaction = useReactionStore((s) => s.triggerReaction);

  const [searchTerm, setSearchTerm] = useState("");

  const [recentEmojis, setRecentEmojis] = useState(() => {
    try {
      const saved = localStorage.getItem("recentEmojis");
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Error loading recent emojis:", error);
      return [];
    }
  });

  const holdStartRef = useRef(null);
  const touchStartPosRef = useRef(null);
  const movedRef = useRef(false);
  const sendingRef = useRef(false);

  const holdTimeoutRef = useRef(null);

  const HOLD_DELAY_MS = 1000;
  const [holdingEmoji, setHoldingEmoji] = useState(null);
  const [intensity, setIntensity] = useState(0);

  const getIntensity = (startTime) => {
    const HOLD_MAX_MS = 5000;

    const elapsed = Date.now() - startTime;

    return Number(Math.min(elapsed / HOLD_MAX_MS, 1).toFixed(6));
  };

  const handlePointerDown = (e, emoji) => {
    touchStartPosRef.current = {
      x: e.clientX,
      y: e.clientY,
    };

    movedRef.current = false;

    holdTimeoutRef.current = setTimeout(() => {
      holdStartRef.current = Date.now();
      setHoldingEmoji(emoji);
    }, HOLD_DELAY_MS);
  };

  const handlePointerMove = (e) => {
    if (!touchStartPosRef.current) return;

    const dx = e.clientX - touchStartPosRef.current.x;
    const dy = e.clientY - touchStartPosRef.current.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 10) {
      movedRef.current = true;

      holdStartRef.current = null;

      setHoldingEmoji(null);
      setIntensity(0);
    }
  };

  const handlePointerUp = (emoji) => {
    if (movedRef.current) {
      cleanupHold();
      return;
    }

    let power = 0;

    if (holdStartRef.current) {
      power = getIntensity(holdStartRef.current);
    }

    sendReact(emoji, power);

    cleanupHold();
  };

  const handlePointerCancel = () => {
    cleanupHold();
  };

  const cleanupHold = () => {
    clearTimeout(holdTimeoutRef.current);

    holdTimeoutRef.current = null;
    holdStartRef.current = null;
    touchStartPosRef.current = null;
    movedRef.current = false;

    setHoldingEmoji(null);
    setIntensity(0);
  };

  useEffect(() => {
    if (!holdingEmoji) return;

    const interval = setInterval(() => {
      if (!holdStartRef.current) return;

      setIntensity(getIntensity(holdStartRef.current));
    }, 16);

    return () => clearInterval(interval);
  }, [holdingEmoji]);

  const sendReact = async (emoji, power) => {
    if (sendingRef.current) return;

    sendingRef.current = true;
    try {
      onClose();

      await SendReactMoment(emoji, selectedMomentId, power);

      SonnerSuccess(t("emoji_studio.sent_success", { emoji, power }));
      triggerReaction(emoji);

      if (!recentEmojis.includes(emoji)) {
        const newRecentEmojis = [emoji, ...recentEmojis.slice(0, 9)];

        setRecentEmojis(newRecentEmojis);

        localStorage.setItem("recentEmojis", JSON.stringify(newRecentEmojis));
      }
    } catch (error) {
      SonnerError(t("emoji_studio.sent_failed"));
      console.error(error);
    } finally {
      sendingRef.current = false;
    }
  };

  const filteredEmojis = EMOJI_GRID.filter((emoji) =>
    emoji.includes(searchTerm),
  );

  const renderEmojiGroup = (title, emojis) => (
    <div className="mb-6">
      <div className="text-sm text-base-content/60 font-medium mb-3">
        {title}
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-18 gap-2 select-none">
        {emojis.map((emoji, index) => {
          const emojiId = `${title}-${emoji}-${index}`;

          return (
            <button
              key={emojiId}
              onPointerDown={(e) => handlePointerDown(e, emojiId)}
              onPointerMove={handlePointerMove}
              onPointerUp={() => handlePointerUp(emoji)}
              onPointerCancel={handlePointerCancel}
              className={clsx(
                "aspect-square w-full flex items-center justify-center text-5xl md:text-5xl rounded-xl hover:bg-base-200 transition-all duration-200",
                {
                  shake: holdingEmoji === emojiId,
                },
              )}
              style={
                holdingEmoji === emojiId
                  ? {
                      "--emoji-scale": 1 + intensity * 0.8, // 1 -> 1.3
                      "--shake-speed": `${Math.max(0.03, 0.15 - intensity * 0.12)}s`,
                    }
                  : undefined
              }
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );

  const [showModal, setShowModal] = useState(false);
  const [animate, setAnimate] = useState(false);

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

  return ReactDOM.createPortal(
    <div
      className={clsx(
        "fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[62]",
        {
          "opacity-100": animate,
          "opacity-0 pointer-events-none": !animate,
        },
      )}
      onClick={() => onClose(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "fixed border-t border-base-300 bottom-0 left-0 w-full h-2/3 bg-base-100 rounded-t-4xl shadow-lg transition-all duration-500 ease-in-out z-[63] flex flex-col text-base-content",
          {
            "translate-y-0 opacity-100": animate,
            "translate-y-full opacity-0": !animate,
          },
        )}
      >
        <div className="flex justify-between items-center py-3 px-4 bg-base-100 rounded-t-4xl sticky top-0 z-50 border-b border-base-200">
          <div className="flex items-center space-x-2 text-primary">
            <Laugh size={22} />

            <div className="text-2xl font-lovehouse mt-1.5 font-semibold">
              Emoji studio
            </div>

            <PlanBadge />
          </div>

          <button
            onClick={() => onClose(false)}
            className="text-primary cursor-pointer hover:bg-base-200 rounded-lg p-1"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-4 py-2">
          <p className="text-sm text-base-content/70">{t("emoji_studio.tap_to_send")}</p>
        </div>

        <div className="px-4 flex-1 flex flex-col overflow-hidden">
          <div className="py-2">
            <input
              type="text"
              placeholder={t("emoji_studio.search_placeholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 w-full rounded-xl border border-base-300 bg-base-200 text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex-1 overflow-y-auto pb-4">
            {searchTerm ? (
              renderEmojiGroup(t("emoji_studio.search_results"), filteredEmojis)
            ) : (
              <>
                {recentEmojis.length > 0 &&
                  renderEmojiGroup(t("emoji_studio.recent"), recentEmojis)}

                {renderEmojiGroup(t("emoji_studio.popular"), POPULAR_EMOJIS)}

                {renderEmojiGroup(t("emoji_studio.all"), EMOJI_GRID)}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default EmojiPicker;
