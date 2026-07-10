import { useMemo } from "react";
import { useAuthStore, useFriendStoreV3, useGroupChatStore } from "@/stores";

import UserOwnerInfo from "./UserOwnerInfo";
import GroupOwnerInfo from "./GroupOwnerInfo";

const MomentOwnerInfo = ({ user: userId, date, groupId }) => {
  const me = useAuthStore((s) => s.user);
  const friendMap = useFriendStoreV3((s) => s.friendDetailsMap);
  const groups = useGroupChatStore((s) => s.groups);

  const groupMap = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  );

  const group = groupId ? groupMap.get(groupId) : null;

  const displayUser =
    !userId || userId === me?.uid
      ? me
      : (friendMap?.[userId] ?? { uid: userId });

  const isMe = !userId || userId === me?.uid;

  if (groupId && group) {
    return (
      <GroupOwnerInfo
        group={group}
        user={displayUser}
        isMe={isMe}
        date={date}
      />
    );
  }

  return <UserOwnerInfo user={displayUser} isMe={isMe} date={date} />;
};

export default MomentOwnerInfo;
