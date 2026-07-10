import { create } from "zustand";
import { getMessagesWithUser } from "@/services";
import {
  getMessagesByConversationId,
  saveMessages,
  deleteMessageById,
} from "@/cache/chatsDB";

const isUuidV4 = (id) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );

const createConversationState = () => ({
  items: [],
  loading: false,
  hasFetched: false,
});

export const useUserMessagesStore = create((set, get) => ({
  messages: {},

  getConversationMessages: (conversationId) =>
    get().messages[conversationId]?.items || [],

  getMessagesByUser: async (conversationId) => {
    if (!conversationId) return [];

    // const state = get().messages[conversationId];

    // if (state?.hasFetched) {
    //   return state.items;
    // }

    set((prev) => ({
      messages: {
        ...prev.messages,
        [conversationId]: {
          ...(prev.messages[conversationId] || createConversationState()),
          loading: true,
        },
      },
    }));

    try {
      const local = await getMessagesByConversationId(conversationId);

      const invalidMessages = local.filter((msg) => isUuidV4(msg.id));

      if (invalidMessages.length) {
        await Promise.all(
          invalidMessages.map((msg) => deleteMessageById(msg.id)),
        );
      }

      const cleanedLocal = local.filter((msg) => !isUuidV4(msg.id));

      set((prev) => ({
        messages: {
          ...prev.messages,
          [conversationId]: {
            items: cleanedLocal,
            loading: true,
            hasFetched: false,
          },
        },
      }));

      // const latest = Math.max(...state.items.map(m => m.update_time || 0));

      const apiData = await getMessagesWithUser({
        messageId: conversationId,
          // timestamp: latest,
      });

      let merged = cleanedLocal;

      if (apiData?.length) {
        await saveMessages(apiData);

        const map = new Map();

        [...apiData, ...cleanedLocal].forEach((msg) => {
          map.set(msg.id, msg);
        });

        merged = [...map.values()].sort(
          (a, b) => b.update_time - a.update_time,
        );
      }

      set((prev) => ({
        messages: {
          ...prev.messages,
          [conversationId]: {
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
          [conversationId]: {
            ...(prev.messages[conversationId] || createConversationState()),
            loading: false,
          },
        },
      }));

      return [];
    }
  },

  addMessage: async (conversationId, message) => {
    if (!conversationId || !message?.id) return;

    const current = get().messages[conversationId]?.items || [];

    if (current.some((m) => m.id === message.id)) {
      return;
    }

    const updated = [message, ...current].sort(
      (a, b) => b.update_time - a.update_time,
    );

    set((prev) => ({
      messages: {
        ...prev.messages,
        [conversationId]: {
          ...(prev.messages[conversationId] || createConversationState()),
          items: updated,
          hasFetched: true,
        },
      },
    }));

    await saveMessages(message);
  },

  addMessages: async (conversationId, newMessages) => {
    if (!conversationId || !newMessages) return;

    const items = Array.isArray(newMessages) ? newMessages : [newMessages];

    const current = get().messages[conversationId]?.items || [];

    const filtered = items.filter(
      (msg) => msg?.id && !current.some((m) => m.id === msg.id),
    );

    if (!filtered.length) return;

    const updated = [...filtered, ...current].sort(
      (a, b) => b.update_time - a.update_time,
    );

    set((prev) => ({
      messages: {
        ...prev.messages,
        [conversationId]: {
          ...(prev.messages[conversationId] || createConversationState()),
          items: updated,
          hasFetched: true,
        },
      },
    }));

    await saveMessages(filtered);
  },

  removeMessage: async (conversationId, messageId) => {
    if (!conversationId || !messageId) return;

    const current = get().messages[conversationId]?.items || [];

    const updated = current.filter((msg) => msg.id !== messageId);

    set((prev) => ({
      messages: {
        ...prev.messages,
        [conversationId]: {
          ...(prev.messages[conversationId] || createConversationState()),
          items: updated,
        },
      },
    }));

    await deleteMessageById(messageId);
  },

  updateReaction: async (
    conversationId,
    messageId,
    userId,
    emoji,
    actionType,
  ) => {
    const current = get().messages[conversationId]?.items || [];

    const updated = current.map((msg) => {
      if (msg.id !== messageId) return msg;

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
        [conversationId]: {
          ...(prev.messages[conversationId] || createConversationState()),
          items: updated,
        },
      },
    }));

    const changed = updated.find((m) => m.id === messageId);

    if (changed) {
      await saveMessages(changed);
    }
  },

  clearConversationMessages: (conversationId) => {
    set((prev) => {
      const next = { ...prev.messages };
      delete next[conversationId];

      return {
        messages: next,
      };
    });
  },

  clearAllMessages: () => {
    set({
      messages: {},
    });
  },
}));


// const items =
//   useUserMessagesStore(
//     (s) => s.messages[conversationId]?.items ?? [],
//   );

// const loading =
//   useUserMessagesStore(
//     (s) => s.messages[conversationId]?.loading ?? false,
//   );

// const hasFetched =
//   useUserMessagesStore(
//     (s) => s.messages[conversationId]?.hasFetched ?? false,
//   );