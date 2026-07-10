import { ArrowUp, SmilePlus } from "lucide-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

export default function MomentReplyBar({
  showFullInput,
  wrapperRef,
  inputRef,
  shortName,
  message,
  setMessage,
  handleSend,
  isSendingMessage,
  isSendingReaction,
  userDetail,
  holdingEmoji,
  intensity,
  handlePointerDown,
  handlePointerCancel,
  handlePointerUp,
  handlePointerMove,
  setShowFullInput,
  setShowEmojiPicker,
}) {
  const { t } = useTranslation("main");
  if (showFullInput) {
    return (
      <div ref={wrapperRef} className="z-50 w-full">
        <div className="relative w-full">
          <div className="flex w-full items-center gap-3 px-4 py-3.5 bg-base-200 rounded-3xl shadow-md">
            <input
              ref={inputRef}
              type="text"
              placeholder={t("bottom.reply_to_user", { name: shortName })}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSendingMessage || userDetail?.isCelebrity}
              className="flex-1 bg-transparent focus:outline-none font-semibold pl-1 disabled:opacity-50"
            />

            <button
              onClick={handleSend}
              disabled={
                isSendingMessage || !message.trim() || userDetail?.isCelebrity
              }
              className="btn absolute right-3 p-1 btn-sm bg-base-300 btn-circle flex justify-center items-center disabled:opacity-50"
            >
              {isSendingMessage ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-base-content" />
              ) : (
                <ArrowUp className="w-7 h-7 text-base-content" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative w-full">
        <div
          className={clsx(
            "flex items-center w-full px-4 py-3.5 rounded-3xl bg-base-200 shadow-md",
            userDetail?.isCelebrity
              ? "cursor-not-allowed opacity-70"
              : "cursor-text",
          )}
          onClick={() => {
            if (!userDetail?.isCelebrity) setShowFullInput(true);
          }}
        >
          <span className="flex-1 pl-1 font-semibold text-md text-base-content/60">
            {t("bottom.send_message_placeholder")}
          </span>
        </div>

        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-4 px-1 pointer-events-auto">
          {["🤣", "💛", "💩"].map((emoji) => (
            <button
              key={emoji}
              title={emoji}
              disabled={isSendingReaction}
              onPointerDown={(e) => handlePointerDown(e, emoji)}
              onPointerMove={handlePointerMove}
              onPointerUp={() => handlePointerUp(emoji)}
              onPointerCancel={handlePointerCancel}
              className={`cursor-pointer select-none text-3xl transition-transform disabled:opacity-50 ${
                holdingEmoji === emoji ? "shake" : ""
              } ${isSendingReaction ? "pointer-events-none" : ""}`}
              style={
                holdingEmoji === emoji
                  ? {
                      "--emoji-scale": 1 + intensity * 0.8,
                      "--shake-speed": `${Math.max(
                        0.03,
                        0.15 - intensity * 0.12,
                      )}s`,
                    }
                  : undefined
              }
            >
              {emoji}
            </button>
          ))}

          <button
            type="button"
            disabled={isSendingReaction}
            className="relative cursor-pointer disabled:opacity-50"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
          >
            <SmilePlus className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
