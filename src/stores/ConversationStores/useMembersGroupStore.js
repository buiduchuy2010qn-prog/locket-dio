import { create } from "zustand";
import { fetchUserById } from "@/services";
import { getFriendDetail } from "@/cache/friendsDB";
import { normalizeFriendDataV2 } from "@/utils";
import { getMemberInfo, putMemberInfo } from "@/cache/groupMembersDB";

export const useMembersGroupStore = create((set, get) => ({
  // userId -> userInfo
  membersMap: {},

  // groupId -> [userId]
  groupMembersMap: {},

  upsertMembers: (users) => {
    const { membersMap } = get();

    const nextMembers = { ...membersMap };

    users.forEach((user) => {
      const uid = user?.uid;

      if (!uid) return;

      nextMembers[uid] = {
        ...nextMembers[uid],
        ...user,
      };
    });

    set({
      membersMap: nextMembers,
    });
  },

  hydrateMembersFromGroups: async (groups = []) => {
    if (!groups?.length) return;

    const myId = localStorage.getItem("localId");

    // =========================
    // Cập nhật groupMembersMap
    // =========================
    const { groupMembersMap } = get();

    const nextGroupMembers = {
      ...groupMembersMap,
    };

    groups.forEach((group) => {
      const groupId = group?.id || group?.group_id || group?.conversation_id;

      if (!groupId) return;

      nextGroupMembers[groupId] =
        group?.users?.map((u) => u?.user_id).filter(Boolean) || [];
    });

    set({
      groupMembersMap: nextGroupMembers,
    });

    // =========================
    // Lấy danh sách user cần fetch
    // =========================
    const userIds = [
      ...new Set(
        groups.flatMap((group) =>
          (group?.users || [])
            .map((u) => u?.user_id)
            .filter((id) => id && id !== myId),
        ),
      ),
    ];

    if (!userIds.length) return;

    const { membersMap, upsertMembers } = get();

    const missingIds = userIds.filter((uid) => !membersMap[uid]);

    if (!missingIds.length) return;

    try {
      const users = await Promise.all(
        missingIds.map(async (uid) => {
          try {
            // Cache local
            const localUser = await getFriendDetail(uid);

            if (localUser) {
              return { ...localUser, status: "friend" };
            }

            const localMember = await getMemberInfo(uid);

            if (localMember) {
              return localMember;
            }

            // API
            const apiUser = await fetchUserById(uid);

            if (apiUser) {
              const userData = normalizeFriendDataV2(apiUser);
              await putMemberInfo(userData);
            }

            return null;
          } catch (err) {
            console.error("[GroupMemberStore] hydrate member error:", uid, err);

            return null;
          }
        }),
      );

      upsertMembers(users.filter(Boolean));
    } catch (err) {
      console.error("[GroupMemberStore] hydrateMembersFromGroups error:", err);
    }
  },

  // Thêm 1 member vào groupMembersMap và fetch profile nếu chưa có
  addMemberToGroup: async (groupId, userId) => {
    if (!groupId || !userId) return;

    const { groupMembersMap, membersMap } = get();
    const currentIds = groupMembersMap[groupId] || [];

    // Nếu đã có rồi thì bỏ qua
    if (currentIds.includes(userId)) return;

    set({
      groupMembersMap: {
        ...groupMembersMap,
        [groupId]: [...currentIds, userId],
      },
    });

    // Fetch profile nếu chưa có trong membersMap
    if (!membersMap[userId]) {
      try {
        const localUser = await getFriendDetail(userId);
        if (localUser) {
          get().upsertMembers([{ ...localUser, status: "friend" }]);
          return;
        }

        const localMember = await getMemberInfo(userId);
        if (localMember) {
          get().upsertMembers([localMember]);
          return;
        }

        const apiUser = await fetchUserById(userId);
        if (apiUser) {
          const userData = normalizeFriendDataV2(apiUser);
          await putMemberInfo(userData);
          get().upsertMembers([userData]);
        }
      } catch (err) {
        console.error("[GroupMemberStore] addMemberToGroup fetch error:", userId, err);
      }
    }
  },

  // Xoá 1 member khỏi groupMembersMap (không xoá membersMap vì user có thể ở nhóm khác)
  removeMemberFromGroup: (groupId, userId) => {
    if (!groupId || !userId) return;

    const { groupMembersMap } = get();
    const currentIds = groupMembersMap[groupId] || [];

    set({
      groupMembersMap: {
        ...groupMembersMap,
        [groupId]: currentIds.filter((id) => id !== userId),
      },
    });
  },

  resetMembers: () => {
    set({
      membersMap: {},
      groupMembersMap: {},
    });
  },
}));
