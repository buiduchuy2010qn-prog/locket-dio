import { useGroupChatStore, useConversationsStore } from "@/stores";
import { useMemo } from "react";

export const useConversations = () => {
  const conversations = useConversationsStore((state) => state.conversations);
  const groups = useGroupChatStore((state) => state.groups);

  return useMemo(() => {
    return [
      ...conversations.map(normalizePrivate),
      ...groups.map(normalizeGroup),
    ].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [conversations, groups]);
};

const normalizePrivate = (chat) => ({
  id: chat.uid,
  type: "with-user",
  with_user: chat.with_user,
  avatar: chat.friendAvatar,
  latestMessage: chat.latest_message?.body ?? chat.latestMessage?.body ?? "",
  replyMoment: chat.latest_message?.reply_moment,
  unreadCount: chat.unread_count ?? chat.unreadCount ?? 0,
  isRead: chat.is_read ?? false,
  updatedAt:
    chat.latest_message?.created_at ??
    chat.last_updated ??
    chat.updateTime * 1000 ??
    0,
  raw: chat,
});

const normalizeGroup = (group) => ({
  id: group.id,
  type: "group",
  name: group.name,
  avatar: group.image_url,
  latestMessage:
    group.latest_message?.content?.content ??
    group.latest_message?.content?.moment?.caption ??
    "[Locket]",
  unreadCount: group.unread_count ?? 0,
  isRead: group.unread_count === 0,
  updatedAt: group.latest_message?.created_at ?? group.last_updated_at ?? 0,
  raw: group,
});
