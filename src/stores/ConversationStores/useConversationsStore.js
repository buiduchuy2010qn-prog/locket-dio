import { create } from "zustand";
import { GetAllMessage } from "@/services";
import {
  getAllConversations,
  saveConversations,
  upsertConversations,
} from "@/cache/chatsDB";

export const useConversationsStore = create((set, get) => ({
  conversations: [],
  loading: false,

  fetchConversations: async () => {
    set({ loading: true });

    try {
      const localData = await getAllConversations();

      set({
        conversations: localData?.length
          ? [...localData].sort((a, b) => b.update_time - a.update_time)
          : [],
      });

      const apiData = await GetAllMessage({ limit: 40 });

      if (apiData?.length) {
        const sorted = [...apiData].sort(
          (a, b) => b.update_time - a.update_time,
        );

        set({
          conversations: sorted,
        });

        await saveConversations(apiData);
      }
    } catch (err) {
      console.error("Fetch conversations error:", err);
    } finally {
      set({ loading: false });
    }
  },

  upsertConversation: async (conversation) => {
    const { conversations } = get();

    const map = new Map(conversations.map((c) => [c.uid, c]));

    map.set(conversation.uid, {
      ...map.get(conversation.uid),
      ...conversation,
      update_time: conversation.update_time || Date.now(),
    });

    const merged = [...map.values()].sort(
      (a, b) => b.update_time - a.update_time,
    );

    set({
      conversations: merged,
    });

    await upsertConversations(conversation);
  },

  addConversation: async (conversation) => {
    const { conversations } = get();

    const map = new Map(conversations.map((c) => [c.uid, c]));

    map.set(conversation.uid, {
      ...map.get(conversation.uid),
      ...conversation,
    });

    const merged = [...map.values()].sort(
      (a, b) => b.update_time - a.update_time,
    );

    set({
      conversations: merged,
    });

    await saveConversations([conversation]);
  },

  updateLatestMessage: async (conversationId, latestMessage) => {
    const conversation = get().conversations.find(
      (c) => c.uid === conversationId,
    );

    if (!conversation) return;

    get().upsertConversation({
      ...conversation,
      latest_message: latestMessage,
      update_time:
        latestMessage?.update_time || latestMessage?.created_at || Date.now(),
    });
  },

  removeConversation: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.filter(
        (c) => c.uid !== conversationId,
      ),
    }));
  },
}));
