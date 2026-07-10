// hooks/useAvailableFriends.js

import { useMemo } from "react";
import { useFriendStoreV3, useMembersGroupStore } from "@/stores";

export function useAvailableFriends(groupId, searchQuery = "") {
  const friendList = useFriendStoreV3((s) => s.friendList);
  const friendDetailsMap = useFriendStoreV3((s) => s.friendDetailsMap);

  const groupMembersMap = useMembersGroupStore((s) => s.groupMembersMap);

  return useMemo(() => {
    const memberIds = new Set(groupMembersMap[groupId] || []);

    return friendList
      .filter((uid) => !memberIds.has(uid))
      .map((uid) => friendDetailsMap[uid])
      .filter(Boolean)
      .filter((friend) => {
        if (!searchQuery) return true;

        const q = searchQuery.toLowerCase();

        return (
          friend?.firstName?.toLowerCase().includes(q) ||
          friend?.lastName?.toLowerCase().includes(q) ||
          friend?.username?.toLowerCase().includes(q)
        );
      });
  }, [groupId, friendList, friendDetailsMap, groupMembersMap, searchQuery]);
}
