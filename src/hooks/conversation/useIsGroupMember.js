import { useMemo } from "react";
import { useAuthStore, useMembersGroupStore } from "@/stores";

export function useIsGroupMember(groupId) {
  const currentUser = useAuthStore((s) => s.user);

  const groupMembersMap = useMembersGroupStore((s) => s.groupMembersMap);

  return useMemo(() => {
    if (!currentUser?.uid) return false;

    const memberIds = groupMembersMap[groupId] || [];

    return memberIds.includes(currentUser.uid);
  }, [currentUser?.uid, groupId, groupMembersMap]);
}
