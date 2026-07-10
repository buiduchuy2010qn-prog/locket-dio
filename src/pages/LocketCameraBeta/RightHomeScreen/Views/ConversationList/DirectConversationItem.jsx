import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { formatTimeAgoV2, getAvatarOrFallback, imageFallback } from "@/utils";
import { useTranslation } from "react-i18next";

export function DirectConversationItem({
  conversation,
  friendDetail,
  isUnread,
  onSelect,
}) {
  const { t } = useTranslation("main");
  const avatar = getAvatarOrFallback(friendDetail?.profilePic);

  const displayName =
    `${friendDetail?.firstName || ""} ${friendDetail?.lastName || ""}`.trim();

  const previewText = conversation.replyMoment
    ? t("right.replied_to_your_locket")
    : conversation.latestMessage || "";

  return (
    <div
      onClick={() =>
        onSelect({
          friend: friendDetail,
          ...conversation,
        })
      }
      className={clsx(
        "relative w-full flex items-center gap-3 p-3 rounded-3xl shadow-sm cursor-pointer transition",
        {
          "bg-base-300": isUnread,
          "bg-base-200": !isUnread,
        },
      )}
    >
      {friendDetail ? (
        <img
          src={avatar}
          alt=""
          className={clsx(
            "w-15 h-15 rounded-full outline-3 p-0.5 object-cover",
            {
              "outline-amber-400": isUnread,
              "outline-gray-300": !isUnread,
            },
          )}
          onError={imageFallback()}
        />
      ) : (
        <div className="w-15 h-15 rounded-full bg-gray-300 animate-pulse" />
      )}

      <div className="flex-1 min-w-0">
        <p
          className={clsx("text-lg truncate", {
            "font-bold": isUnread,
            "font-semibold text-base-content/50": !isUnread,
          })}
        >
          {displayName}~
          {formatTimeAgoV2(Number(conversation?.updatedAt))}
        </p>

        <p
          className={clsx("text-md truncate pt-1 font-semibold", {
            "text-base-content": isUnread,
            "text-base-content/50": !isUnread,
          })}
        >
          {previewText}
        </p>
      </div>

      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500" />
    </div>
  );
}
