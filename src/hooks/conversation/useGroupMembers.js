// hooks/useGroupMembers.js

import { useMemo } from "react";
import { useMembersGroupStore } from "@/stores";

export function useGroupMembers(groupId) {
  const membersMap = useMembersGroupStore((s) => s.membersMap);

  const groupMembersMap = useMembersGroupStore((s) => s.groupMembersMap);

  return useMemo(() => {
    return (groupMembersMap[groupId] || [])
      .map((uid) => membersMap[uid])
      .filter(Boolean);
  }, [groupId, membersMap, groupMembersMap]);
}
