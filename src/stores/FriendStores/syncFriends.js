// Đồng bộ friend IDs + details với server
import {
  getFriendIds,
  getAllFriendDetails,
  setFriendDetailsBulk,
  putNewFriendId,
  removeFriendToCache,
} from "@/cache/friendsDB";
import { addRemovedFriend } from "@/cache/diaryDB";
import { getListIdFriends, loadFriendDetailsV3 } from "@/services";
import { diffFriendIds } from "./diffFriendIds";

const buildLocalRelations = (localDetails) => {
  const map = {};
  for (const f of localDetails) {
    if (!f?.uid) continue;
    map[f.uid] = {
      hidden: f.hidden ?? false,
      sharedHistoryOn: f.sharedHistoryOn ?? null,
      isCelebrity: f.isCelebrity ?? false,
      createdAt: f.createdAt ?? 0,
      updatedAt: f.updatedAt ?? null,
    };
  }
  return map;
};

/**
 * Chuẩn hoá mảng friends từ API (lọc null / thiếu uid)
 */
function normalizeApiFriends(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f) => f && (f.uid || f.user_uid || f.userUid))
    .map((f) => ({
      uid: f.uid || f.user_uid || f.userUid,
      hidden: f.hidden ?? false,
      sharedHistoryOn: f.sharedHistoryOn ?? f.shared_history_on ?? null,
      isCelebrity: f.isCelebrity ?? f.celebrity ?? false,
      createdAt: f.createdAt ?? f.created_at ?? 0,
      updatedAt: f.updatedAt ?? f.updated_at ?? null,
    }));
}

export const syncFriendsWithServer = async () => {
  let localDetails = await getAllFriendDetails();

  try {
    const raw = await getListIdFriends();

    // API fail → fallback local (không xoá list)
    if (raw === null) {
      return {
        details: localDetails,
        friendRelationsMap: buildLocalRelations(localDetails),
        isFallback: true,
      };
    }

    const apiFriends = normalizeApiFriends(raw);

    // API trả rỗng thật → giữ local nếu còn; không coi là fallback hard fail
    if (apiFriends.length === 0) {
      return {
        details: localDetails,
        friendRelationsMap: buildLocalRelations(localDetails),
        isFallback: localDetails.length > 0,
        emptyFromServer: true,
      };
    }

    const friendRelationsMap = Object.fromEntries(
      apiFriends.map((f) => [
        f.uid,
        {
          hidden: f.hidden ?? false,
          sharedHistoryOn: f.sharedHistoryOn ?? null,
          isCelebrity: f.isCelebrity ?? false,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        },
      ]),
    );

    const cachedIds = await getFriendIds();
    const { newIds, removedIds } = diffFriendIds(apiFriends, cachedIds);

    // REMOVE
    if (removedIds.length > 0) {
      for (const f of removedIds) {
        await removeFriendToCache(f.uid);
        await addRemovedFriend(f.uid);
      }
      const removedSet = new Set(removedIds.map((f) => f.uid));
      localDetails = localDetails.filter((f) => !removedSet.has(f.uid));
    }

    // ADD ids mới
    if (newIds.length > 0) {
      await putNewFriendId(newIds);
    }

    // Details thiếu: bạn mới HOẶC id có trong API nhưng chưa có profile cache
    const detailUidSet = new Set(
      (localDetails || []).map((f) => f.uid).filter(Boolean),
    );
    const missingForDetails = apiFriends.filter(
      (f) => f.uid && !detailUidSet.has(f.uid),
    );

    if (missingForDetails.length > 0) {
      const newDetails = await loadFriendDetailsV3(missingForDetails);
      if (newDetails?.length > 0) {
        // Merge theo uid (tránh duplicate)
        const byUid = new Map(
          [...localDetails, ...newDetails]
            .filter((f) => f?.uid)
            .map((f) => [f.uid, f]),
        );
        localDetails = Array.from(byUid.values());
        await setFriendDetailsBulk(localDetails);
      } else {
        // API detail fail — vẫn tạo stub để UI hiện danh sách
        const stubs = missingForDetails.map((f) => ({
          uid: f.uid,
          firstName: "",
          lastName: "",
          username: f.uid.slice(0, 8),
          profilePic: null,
          isCelebrity: f.isCelebrity ?? false,
        }));
        const byUid = new Map(
          [...localDetails, ...stubs]
            .filter((x) => x?.uid)
            .map((x) => [x.uid, x]),
        );
        localDetails = Array.from(byUid.values());
        await setFriendDetailsBulk(localDetails);
      }
    }

    // Đảm bảo friendIds table đủ toàn bộ API list
    try {
      await putNewFriendId(apiFriends);
    } catch {
      /* ignore */
    }

    return {
      details: localDetails,
      friendRelationsMap,
      isFallback: false,
    };
  } catch (err) {
    console.error("sync failed → fallback local", err);

    return {
      details: localDetails,
      friendRelationsMap: buildLocalRelations(localDetails),
      isFallback: true,
    };
  }
};
