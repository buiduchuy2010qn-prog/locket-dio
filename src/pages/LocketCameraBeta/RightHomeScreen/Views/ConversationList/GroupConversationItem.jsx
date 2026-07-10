import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { formatTimeAgoV2, imageFallback } from "@/utils";
import { GroupAvatarStack } from "@/components/ui/ConversationItem/GroupAvatarStack";
import { GroupMembersLabel } from "@/components/ui/ConversationItem/GroupMembersLabel";

export function GroupConversationItem({
  conversation,
  members,
  isUnread,
  onSelect,
}) {
  const visibleMembers = members.slice(0, 5);

  return (
    <div
      onClick={() => onSelect(conversation)}
      className={clsx(
        "relative w-full flex items-center gap-3 p-3 rounded-3xl shadow-sm cursor-pointer transition",
        {
          "bg-base-300": isUnread,
          "bg-base-200": !isUnread,
        },
      )}
    >
      {conversation.avatar ? (
        <img
          src={conversation.avatar}
          alt={conversation.name}
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
        <div
          className={clsx(
            "w-15 h-15 rounded-full flex items-center justify-center transition-all duration-200 outline-3 p-0.5",
            {
              "outline-amber-400": isUnread,
              "outline-gray-300": !isUnread,
            },
          )}
        >
          <GroupAvatarStack members={visibleMembers} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p
          className={clsx("text-lg truncate", {
            "font-bold": isUnread,
            "font-semibold text-base-content/50": !isUnread,
          })}
        >
          {conversation.name ? (
            conversation.name
          ) : (
            <GroupMembersLabel members={members} />
          )}
          ~{formatTimeAgoV2(Number(conversation.updatedAt))}
        </p>

        <p
          className={clsx("text-md truncate pt-1 font-semibold", {
            "text-base-content": isUnread,
            "text-base-content/50": !isUnread,
          })}
        >
          {conversation.latestMessage}
        </p>
      </div>

      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500" />
    </div>
  );
}
