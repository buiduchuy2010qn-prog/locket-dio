import { useMemo } from "react";
import { useAuthStore, useGroupChatStore } from "@/stores";

export function useHasGroup() {
  const user = useAuthStore((s) => s.user);
  const groups = useGroupChatStore((s) => s.groups);

  return useMemo(() => {
    if (!user?.uid) return false;

    return groups.some((g) => g.id?.startsWith(`${user.uid}-`));
  }, [groups, user?.uid]);
}
