import { create } from "zustand";
import {
  getAllFriendDetails,
  addFriendToCache,
  removeFriendToCache,
  putInfobyID,
  setFriendDetailsBulk,
} from "@/cache/friendsDB";
import { syncFriendsWithServer } from "./syncFriends";
import { addRemovedFriend } from "@/cache/diaryDB";
import { buildFriendDetailsMap } from "./buildFriendData";
import { sortFriends } from "./sortFriendData";
import { loadFriendDetailsV3 } from "@/services";

export const useFriendStoreV3 = create((set, get) => ({
  friendList: [],
  friendDetailsMap: {},
  friendRelationsMap: {},
  loading: false,

  // -------------------------
  // 🔥 REBUILD (OPTIMIZED)
  // -------------------------
  rebuildFriendList: () => {
    const { friendDetailsMap, friendRelationsMap, friendList } = get();

    // Union: có relations (từ API) HOẶC details (từ cache) — không phụ thuộc chỉ details
    const uidSet = new Set([
      ...Object.keys(friendRelationsMap || {}),
      ...Object.keys(friendDetailsMap || {}),
    ]);

    const merged = [...uidSet].map((uid) => ({
      uid,
      isCelebrity:
        friendRelationsMap[uid]?.isCelebrity ??
        friendDetailsMap[uid]?.isCelebrity ??
        false,
      hidden: friendRelationsMap[uid]?.hidden ?? false,
      createdAt:
        friendRelationsMap[uid]?.createdAt ??
        friendDetailsMap[uid]?.createdAt ??
        0,
    }));

    const newList = sortFriends(merged).map((f) => f.uid);

    if (
      newList.length === friendList.length &&
      newList.every((id, i) => id === friendList[i])
    ) {
      return;
    }

    set({ friendList: newList });
  },

  // -------------------------
  // ⚡ LOAD LOCAL ONLY
  // -------------------------
  loadFriendsLocalOnly: async () => {
    try {
      const localDetails = await getAllFriendDetails();

      const detailsMap = buildFriendDetailsMap(localDetails);

      const relationsMap = {};
      for (const f of localDetails) {
        relationsMap[f.uid] = {
          hidden: f.hidden ?? false,
          sharedHistoryOn: f.sharedHistoryOn ?? null,
          isCelebrity: f.isCelebrity ?? false,
          createdAt: f.createdAt ?? 0,
          updatedAt: f.updatedAt ?? null,
        };
      }

      set({
        friendDetailsMap: detailsMap,
        friendRelationsMap: relationsMap,
      });

      get().rebuildFriendList();
    } catch (err) {
      console.error("loadFriendsLocalOnly error:", err);
    }
  },

  // -------------------------
  // 🔄 FETCH + BACKGROUND SYNC
  // -------------------------
  fetchAndSyncFriends: async (silent = false, force = false) => {
    if (!silent) set({ loading: true });

    try {
      await get().loadFriendsLocalOnly();

      const { friendList } = get();
      const lastSync = Number(localStorage.getItem("friendsLastSync") || 0);
      // Cache ngắn hơn + luôn sync nếu list rỗng (sau logout / DB clear)
      const CACHE_MS = 30 * 60 * 1000; // 30 phút
      const shouldSync =
        force ||
        friendList.length === 0 ||
        !lastSync ||
        Date.now() - lastSync > CACHE_MS;

      if (!shouldSync) return;

      const res = await syncFriendsWithServer();

      // Fallback vẫn apply local maps (đã load); chỉ skip nếu null hoàn toàn
      if (!res) return;

      const { details, friendRelationsMap } = res;
      const newDetailsMap = buildFriendDetailsMap(details || []);

      // Relations từ server ưu tiên; fallback giữ state cũ + local
      set((state) => ({
        friendDetailsMap: {
          ...state.friendDetailsMap,
          ...newDetailsMap,
        },
        friendRelationsMap: res.isFallback
          ? {
              ...friendRelationsMap,
              ...state.friendRelationsMap,
            }
          : {
              ...friendRelationsMap,
            },
      }));

      get().rebuildFriendList();

      if (!res.isFallback) {
        localStorage.setItem("friendsLastSync", Date.now().toString());
      }
    } catch (err) {
      console.error("fetchAndSyncFriends error:", err);
    } finally {
      if (!silent) set({ loading: false });
    }
  },

  // -------------------------
  // ⚡ REFRESH FRIENDS DATA (loadFriendDetailsV3)
  // -------------------------
  refreshFriendsData: async () => {
    set({ loading: true });

    try {
      // 1. Fetch và đồng bộ danh sách UID bạn bè từ API trước
      await get().fetchAndSyncFriends(true, true);

      // 2. Lấy UIDs bạn bè hiện tại từ store sau khi đã đồng bộ
      const { friendList } = get();

      if (friendList && friendList.length > 0) {
        // Map thành list [{ uid }] để truyền vào loadFriendDetailsV3
        const friendObjects = friendList.map((uid) => ({ uid }));

        // 3. Gọi api fetch thông tin chi tiết cho tất cả bạn bè này
        const freshDetails = await loadFriendDetailsV3(friendObjects);

        if (freshDetails && freshDetails.length > 0) {
          // 4. Lưu dữ liệu mới nhất vào IndexedDB
          await setFriendDetailsBulk(freshDetails);

          // 5. Cập nhật chi tiết mới vào store details map
          const newDetailsMap = buildFriendDetailsMap(freshDetails);
          set((state) => ({
            friendDetailsMap: {
              ...state.friendDetailsMap,
              ...newDetailsMap,
            },
          }));

          // 6. Rebuild lại danh sách hiển thị
          get().rebuildFriendList();
        }
      }
    } catch (err) {
      console.error("refreshFriendsData error:", err);
    } finally {
      set({ loading: false });
    }
  },

  // -------------------------
  // ADD
  // -------------------------
  addFriendLocal: async (friend) => {
    if (!friend?.uid) return;

    const createdAt = friend.createdAt || Date.now();

    await addFriendToCache({ ...friend, createdAt });

    set((state) => ({
      friendDetailsMap: {
        ...state.friendDetailsMap,
        [friend.uid]: friend,
      },
      friendRelationsMap: {
        ...state.friendRelationsMap,
        [friend.uid]: { createdAt },
      },
    }));

    get().rebuildFriendList();
  },

  // -------------------------
  // HIDDEN
  // -------------------------
  hiddenUserState: async (uid, hidden) => {
    if (!uid) return;

    set((state) => ({
      friendRelationsMap: {
        ...state.friendRelationsMap,
        [uid]: {
          ...state.friendRelationsMap[uid],
          hidden,
        },
      },
    }));

    await putInfobyID({ uid, hidden });

    //chỉ rebuild nếu hidden ảnh hưởng sort
    get().rebuildFriendList();
  },

  // -------------------------
  // REMOVE
  // -------------------------
  removeFriendLocal: async (uid) => {
    await removeFriendToCache(uid);
    await addRemovedFriend(uid);

    set((state) => {
      const { [uid]: _, ...restDetails } = state.friendDetailsMap;
      const { [uid]: __, ...restRelations } = state.friendRelationsMap;

      return {
        friendDetailsMap: restDetails,
        friendRelationsMap: restRelations,
      };
    });

    get().rebuildFriendList();
  },

  // -------------------------
  // CLEAR
  // -------------------------
  clearFriends: () =>
    set({
      friendList: [],
      friendDetailsMap: {},
      friendRelationsMap: {},
    }),
}));
