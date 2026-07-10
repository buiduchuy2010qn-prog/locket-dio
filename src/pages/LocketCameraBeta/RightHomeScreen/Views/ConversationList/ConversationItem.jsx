import { useFriendStoreV3 } from "@/stores";

import { GroupConversationItem } from "./GroupConversationItem";
import { DirectConversationItem } from "./DirectConversationItem";
import { useGroupMembers } from "@/hooks";

export function ConversationItem({ conversation, onSelect }) {
  const friendMap = useFriendStoreV3((s) => s.friendDetailsMap);

  const isUnread = conversation.isRead === false;
  const friendDetail = friendMap?.[conversation.with_user] ?? null;

  //Group
  const members = useGroupMembers(conversation?.id);

  if (conversation.type === "group") {
    return (
      <GroupConversationItem
        conversation={conversation}
        members={members}
        isUnread={isUnread}
        onSelect={onSelect}
      />
    );
  }

  return (
    <DirectConversationItem
      conversation={conversation}
      friendDetail={friendDetail}
      isUnread={isUnread}
      onSelect={onSelect}
    />
  );
}
