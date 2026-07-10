import { create } from "zustand";
import { getGroupMessages } from "@/services";
import {
  getMessagesByConversationId,
  saveMessages,
  deleteMessageById,
} from "@/cache/chatsDB";
import { useGroupChatStore } from "./useGroupChatStore";

const createGroupState = () => ({
  items: [],
  loading: false,
  hasFetched: false,
});

// messages: {
//   [groupId]: {
//     items: [],
//     loading: false,
//     hasFetched: false,
//   }
// }
export const useGroupMessagesStore = create((set, get) => ({
  messages: {},

  getGroupMessages: (groupId) => get().messages[groupId]?.items || [],

  fetchGroupMessages: async (groupId) => {
    if (!groupId) return [];

    // const state = get().messages[groupId];

    // if (state?.hasFetched) {
    //   return state.items;
    // }

    set((prev) => ({
      messages: {
        ...prev.messages,
        [groupId]: {
          ...(prev.messages[groupId] || createGroupState()),
          loading: true,
        },
      },
    }));

    try {
      const local = await getMessagesByConversationId(groupId);

      set((prev) => ({
        messages: {
          ...prev.messages,
          [groupId]: {
            items: local,
            loading: true,
            hasFetched: false,
          },
        },
      }));

      const apiData = await getGroupMessages({
        groupId,
        limit: 40,
      });

      let merged = local;

      if (apiData?.messages?.length) {
        const normalized = apiData.messages.map((msg) => ({
          ...msg,
          uid: groupId,
          sender: msg.user_id,
          text: msg.content?.content || "",
          create_time: Number(msg.created_at || 0) / 1000,
          update_time: Number(msg.created_at || 0),
        }));

        await saveMessages(normalized);

        const map = new Map();

        [...normalized, ...local].forEach((msg) => {
          map.set(msg.id, msg);
        });

        merged = [...map.values()].sort(
          (a, b) => b.update_time - a.update_time,
        );
      }

      set((prev) => ({
        messages: {
          ...prev.messages,
          [groupId]: {
            items: merged,
            loading: false,
            hasFetched: true,
          },
        },
      }));

      return merged;
    } catch (error) {
      console.error(error);

      set((prev) => ({
        messages: {
          ...prev.messages,
          [groupId]: {
            ...(prev.messages[groupId] || createGroupState()),
            loading: false,
          },
        },
      }));

      return [];
    }
  },

  loadMoreGroupMessages: async (groupId) => {
    if (!groupId) return false;

    const current = get().messages[groupId]?.items || [];

    if (!current.length) {
      return false;
    }

    let beforeTimestamp = 0;

    for (const msg of current) {
      const ts = Number(msg.created_at || 0);

      if (ts > 0 && (beforeTimestamp === 0 || ts < beforeTimestamp)) {
        beforeTimestamp = ts;
      }
    }

    if (!beforeTimestamp) {
      return false;
    }

    try {
      const apiData = await getGroupMessages({
        groupId,
        limit: 40,
        beforeTimestamp,
      });

      if (!apiData?.messages?.length) {
        return false;
      }

      const normalized = apiData.messages.map((msg) => ({
        ...msg,
        uid: groupId,
        sender: msg.user_id,
        text: msg.content?.content || "",
        create_time: Number(msg.created_at || 0) / 1000,
        update_time: Number(msg.created_at || 0),
      }));

      await saveMessages(normalized);

      const merged = [...current, ...normalized].sort(
        (a, b) => b.update_time - a.update_time,
      );

      const unique = [...new Map(merged.map((m) => [m.id, m])).values()];

      set((prev) => ({
        messages: {
          ...prev.messages,
          [groupId]: {
            ...(prev.messages[groupId] || createGroupState()),
            items: unique,
          },
        },
      }));

      return normalized.length === 40;
    } catch (err) {
      console.error("Failed to load older group messages:", err);
      return false;
    }
  },

  addGroupMessage: async (groupId, message) => {
    if (!groupId || !message?.id) return;

    const current = get().messages[groupId]?.items || [];

    if (current.some((m) => m.id === message.id)) {
      return;
    }

    const updated = [message, ...current].sort(
      (a, b) => b.update_time - a.update_time,
    );

    set((prev) => ({
      messages: {
        ...prev.messages,
        [groupId]: {
          ...(prev.messages[groupId] || createGroupState()),
          items: updated,
          hasFetched: true,
        },
      },
    }));

    await saveMessages(message);
  },

  addGroupMessages: async (groupId, newMessages) => {
    if (!groupId || !newMessages) return;

    const items = Array.isArray(newMessages) ? newMessages : [newMessages];

    const current = get().messages[groupId]?.items || [];

    const filtered = items.filter(
      (msg) => msg?.id && !current.some((m) => m.id === msg.id),
    );

    if (!filtered.length) {
      return;
    }

    const updated = [...filtered, ...current].sort(
      (a, b) => b.update_time - a.update_time,
    );

    set((prev) => ({
      messages: {
        ...prev.messages,
        [groupId]: {
          ...(prev.messages[groupId] || createGroupState()),
          items: updated,
          hasFetched: true,
        },
      },
    }));

    await saveMessages(filtered);
  },

  updateGroupMessageReaction: async (
    groupId,
    messageId,
    userId,
    emoji,
    actionType,
  ) => {
    const current = get().messages[groupId]?.items || [];

    const updated = current.map((msg) => {
      if (msg.id !== messageId) {
        return msg;
      }

      let reactions = [...(msg.reactions || [])];

      if (actionType === "reactionAdded") {
        reactions = reactions.filter((r) => r.user_id !== userId);

        reactions.push({
          user_id: userId,
          emoji,
        });
      }

      if (actionType === "reactionRemoved") {
        reactions = reactions.filter((r) => r.user_id !== userId);
      }

      return {
        ...msg,
        reactions,
      };
    });

    set((prev) => ({
      messages: {
        ...prev.messages,
        [groupId]: {
          ...(prev.messages[groupId] || createGroupState()),
          items: updated,
        },
      },
    }));

    const changed = updated.find((m) => m.id === messageId);

    if (changed) {
      await saveMessages(changed);
    }
  },

  removeGroupMessage: async (groupId, messageId) => {
    if (!groupId || !messageId) return;

    const current = get().messages[groupId]?.items || [];

    const updated = current.filter((msg) => msg.id !== messageId);

    set((prev) => ({
      messages: {
        ...prev.messages,
        [groupId]: {
          ...(prev.messages[groupId] || createGroupState()),
          items: updated,
        },
      },
    }));

    await deleteMessageById(messageId);

    const groupStore = useGroupChatStore.getState();

    const group = groupStore.groups.find((g) => g.id === groupId);

    if (group?.latest_message?.id === messageId) {
      const next = updated[0];

      groupStore.updateGroupState(groupId, {
        latest_message: next
          ? {
              id: next.id,
              created_at: Number(next.created_at) || Number(next.update_time),
              updated_at: next.updated_at ?? null,
              user_id: next.user_id,
              content: next.content,
              reactions: next.reactions || [],
            }
          : null,
      });
    }
  },

  clearGroupMessages: (groupId) => {
    set((prev) => {
      const next = {
        ...prev.messages,
      };

      delete next[groupId];

      return {
        messages: next,
      };
    });
  },

  clearAllGroupMessages: () => {
    set({
      messages: {},
    });
  },
}));
