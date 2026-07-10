import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import MessageReactions from "../../components/MessageReactions";
import { MessageContextMenu } from "../../Layout/MessageContextMenu";
import {
  SonnerInfo,
  SonnerPromise,
  SonnerSuccess,
  SonnerWarning,
} from "@/components/ui/SonnerToast";
import { getAvatarOrFallback, imageFallback } from "@/utils";
import { useUserMessagesStore } from "@/stores";
import {
  deleteMessage,
  sendReactionOnMessage,
  removeReactionOnMessage,
} from "@/services";
import MessageThumbnail from "../../components/MessageThumbnail";
import { useTranslation } from "react-i18next";

// ================= Component: MessageItem =================
const MessageItem = ({ msg, selectedChat }) => {
  const me = localStorage.getItem("localId");
  const isMe = msg.sender === me;
  const { t } = useTranslation("main");

  const [showMenu, setShowMenu] = useState(false);
  const [menuDirection, setMenuDirection] = useState("center");

  const bubbleRef = useRef(null);
  const holdTimerRef = useRef(null);
  const isLongPress = useRef(false);

  const removeMessage = useUserMessagesStore((s) => s.removeMessage);
  const updateReaction = useUserMessagesStore((s) => s.updateReaction);

  useEffect(() => {
    if (!showMenu) return;

    const prevent = (e) => e.preventDefault();

    document.body.style.overflow = "hidden";
    // document.addEventListener("touchmove", prevent, {
    //   passive: false,
    // });

    return () => {
      document.body.style.overflow = "";
      // document.removeEventListener("touchmove", prevent);
    };
  }, [showMenu]);

  const showContextMenu = useCallback(() => {
    if (bubbleRef.current) {
      const rect = bubbleRef.current.getBoundingClientRect();

      const viewportHeight = window.innerHeight;

      const topZone = viewportHeight * 0.3;
      const bottomZone = viewportHeight * 0.7;

      if (rect.top < topZone) {
        setMenuDirection("bottom");
      } else if (rect.bottom > bottomZone) {
        setMenuDirection("top");
      } else {
        setMenuDirection("center");
      }
    }

    setShowMenu(true);
  }, []);

  const handleTouchStart = useCallback(() => {
    isLongPress.current = false;

    holdTimerRef.current = setTimeout(() => {
      isLongPress.current = true;

      if (bubbleRef.current) {
        const rect = bubbleRef.current.getBoundingClientRect();

        showContextMenu(isMe ? rect.right : rect.left, rect.top);
      }
    }, 400);
  }, [isMe, showContextMenu]);

  const handleTouchMove = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();

      isLongPress.current = false;
    }
  }, []);

  const handleContextMenu = useCallback(
    (e) => {
      e.preventDefault();

      showContextMenu(e.clientX, e.clientY);
    },
    [showContextMenu],
  );

  const handleReaction = (emoji) => {
    if (!selectedChat?.id) return;

    setShowMenu(false);

    const existing = msg.reactions?.find((r) => r.user_id === me);

    if (existing?.emoji === emoji) {
      const promise = removeReactionOnMessage({
        messageId: msg.id,
        conversationId: selectedChat.id,
      });
      SonnerPromise(promise, {
        loading: t("right.removing_reaction"),
        success: () => {
          updateReaction(
            selectedChat.id,
            msg.id,
            me,
            null,
            "reactionRemoved",
          );
          return t("right.reaction_removed");
        },
        error: t("right.remove_reaction_failed"),
      });
    } else {
      const promise = sendReactionOnMessage({
        messageId: msg.id,
        conversationId: selectedChat.id,
        emoji,
      });
      SonnerPromise(promise, {
        loading: t("right.adding_reaction"),
        success: () => {
          updateReaction(
            selectedChat.id,
            msg.id,
            me,
            emoji,
            "reactionAdded",
          );
          return t("right.reaction_added");
        },
        error: t("right.add_reaction_failed"),
      });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.text || "");

      SonnerSuccess(t("right.message_copied"));
    } catch {
      SonnerInfo(t("right.cannot_copy"));
    }

    setShowMenu(false);
  };

  const handleRecall = () => {
    if (!selectedChat?.id || !msg?.id) return;

    setShowMenu(false);

    const promise = deleteMessage({
      messageId: msg.id,
      conversationId: selectedChat.id,
    });

    SonnerPromise(promise, {
      loading: t("right.recalling_message"),
      success: () => {
        removeMessage(selectedChat.id, msg.id);
        return t("right.message_recalled");
      },
      error: t("right.recall_message_failed"),
    });
  };

  const handleReport = () => {
    SonnerWarning(t("right.report_in_development"));
    setShowMenu(false);
  };
  const myReaction = msg.reactions?.find(({ sender }) => sender === me)?.emoji;
  return (
    <>
      {msg.thumbnail_url && (
        <div
          className={clsx("mb-2 flex", {
            "justify-end pr-2": isMe,
            "justify-start pl-2": !isMe,
          })}
        >
          <MessageThumbnail src={msg?.thumbnail_url} />
        </div>
      )}
      <div
        className={clsx("chat", {
          "chat-end": isMe,
          "chat-start": !isMe,
        })}
        key={msg.id}
      >
        {!isMe && (
          <div className="chat-image avatar">
            <div className="w-8 h-8 rounded-full border border-base-300">
              <img
                src={getAvatarOrFallback(selectedChat?.friend?.profilePic)}
                alt={selectedChat?.friend?.firstName}
                onError={imageFallback()}
              />
            </div>
          </div>
        )}
        <div
          onClick={() => {
            setShowMenu(false);
          }}
          className={clsx(
            "fixed inset-0 bg-base-100/30 backdrop-blur-[4px] transition-opacity duration-500 z-[50]",
            {
              "opacity-100 select-none": showMenu,
              "opacity-0 pointer-events-none": !showMenu,
            },
          )}
        />

        <div
          ref={bubbleRef}
          className={clsx(
            "chat-bubble relative bg-base-200 text-base-content font-medium max-w-xs md:max-w-md select-none rounded-t-2xl transition-all duration-500 scale-100",
            {
              "rounded-bl-2xl": isMe,
              "rounded-br-2xl": !isMe,
              "relative z-[50] scale-110": showMenu,
              "translate-x-3": showMenu && !isMe,
              "-translate-x-3": showMenu && isMe,
              "-translate-y-14": showMenu && menuDirection === "top",
              "translate-y-14": showMenu && menuDirection === "bottom",
              "mt-5": Boolean(msg.reactions?.length),
            },
          )}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
        >
          {msg.text}

          <MessageReactions reactions={msg.reactions} isMe={isMe} />
          <MessageContextMenu
            show={showMenu}
            isMe={isMe}
            content={msg.text}
            myReaction={myReaction}
            onReaction={handleReaction}
            onCopy={handleCopy}
            onRecall={handleRecall}
            onReport={handleReport}
          />
        </div>
        <div className="chat-footer opacity-50 text-xs">
          {new Date(Number(msg.create_time) * 1000).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </>
  );
};

export default MessageItem;
