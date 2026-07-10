import { create } from "zustand";

let clearTimer = null;

export const useReactionStore = create((set) => ({
  reaction: null,

  triggerReaction: (input) => {
    const reactions = Array.isArray(input) ? input : [input];

    const validReactions = reactions.filter(
      (reaction) => typeof reaction === "string" && reaction.trim() !== "",
    );

    if (!validReactions.length) return;

    if (clearTimer) {
      clearTimeout(clearTimer);
    }

    set({
      reaction: {
        id: crypto.randomUUID(),
        reactions: validReactions,
      },
    });

    clearTimer = setTimeout(() => {
      set({ reaction: null });
      clearTimer = null;
    }, 10000);
  },
}));
