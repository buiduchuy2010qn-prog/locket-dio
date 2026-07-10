// cache/friendDB.js
import db from "./configDB";

const friendDB = db;

// ===== Friend IDs =====
export const setFriendIds = async (friends) => {
  try {
    // friends = [{ uid, createdAt }]
    await friendDB.friendIds.clear();
    await friendDB.friendIds.bulkPut(friends);
    // console.log(`💾 Đã lưu ${friends.length} friend IDs`);
  } catch (err) {
    console.error("❌ Lỗi khi lưu friendIds:", err);
  }
};

export const getFriendIds = async () => {
  return await friendDB.friendIds.toArray();
};

export const putNewFriendId = async (newFriends) => {
  await friendDB.friendIds.bulkPut(newFriends);
}

export const putInfobyID = async (newFriends) => {
  try {
    await friendDB.friendIds.put(newFriends);
  } catch (err) {
    console.error("❌ Lỗi khi lưu moment:", err);
  }
};
// ===== Friend Details =====
export const setFriendDetail = async (friend) => {
  try {
    await friendDB.friendDetails.clear();
    await friendDB.friendDetails.bulkPut(friend);
  } catch (err) {
    console.error("❌ Lỗi khi lưu friend detail:", err);
  }
};

export const setFriendDetailsBulk = async (friends) => {
  try {
    if (!Array.isArray(friends)) return;
    // Cho phép clear khi [] — và bulkPut khi có data
    await friendDB.friendDetails.clear();
    if (friends.length > 0) {
      const valid = friends.filter((f) => f && f.uid);
      if (valid.length) await friendDB.friendDetails.bulkPut(valid);
    }
  } catch (err) {
    console.error("❌ Lỗi khi lưu friend details:", err);
  }
};

// Lấy toàn bộ friend details
export const getAllFriendDetails = async () => {
  try {
    return await friendDB.friendDetails.toArray();
  } catch (err) {
    console.error("❌ Lỗi khi lấy toàn bộ friend details:", err);
    return [];
  }
};

export const getFriendDetail = async (uid) => {
  return await friendDB.friendDetails.get(uid);
};

// ===== Xoá Friend =====

// Xoá 1 friendId
export const deleteFriendId = async (uid) => {
  try {
    await friendDB.friendIds.delete(uid);
  } catch (err) {
    console.error("❌ Lỗi khi xoá friendId:", err);
  }
};

// Xoá toàn bộ friendIds
export const clearFriendIds = async () => {
  try {
    await friendDB.friendIds.clear();
  } catch (err) {
    console.error("❌ Lỗi khi xoá toàn bộ friendIds:", err);
  }
};

// Xoá 1 friend detail
export const deleteFriendDetail = async (uid) => {
  try {
    await friendDB.friendDetails.delete(uid);
  } catch (err) {
    console.error("❌ Lỗi khi xoá friend detail:", err);
  }
};

// Xoá toàn bộ friendDetails
export const clearFriendDetails = async () => {
  try {
    await friendDB.friendDetails.clear();
  } catch (err) {
    console.error("❌ Lỗi khi xoá toàn bộ friendDetails:", err);
  }
};

// cache/friendDB.js

export const syncFriendsWithCache = async (apiFriends) => {
  try {
    // 1. Lấy friend IDs trong DB
    const cachedIds = await getFriendIds();
    const cachedMap = new Map(cachedIds.map((f) => [f.uid, f]));

    // 2. Tạo tập hợp UID
    const apiUids = new Set(apiFriends.map((f) => f.uid));
    const cachedUids = new Set(cachedIds.map((f) => f.uid));

    // 3. Xác định friend mới và friend xoá
    const newFriends = apiFriends.filter((f) => !cachedMap.has(f.uid));
    const removedFriends = cachedIds.filter((f) => !apiUids.has(f.uid));

    // 4. Update DB
    if (newFriends.length > 0) {
      await friendDB.friendIds.bulkPut(newFriends);
    }
    if (removedFriends.length > 0) {
      for (const f of removedFriends) {
        await deleteFriendId(f.uid);
        await deleteFriendDetail(f.uid);
      }
    }

    return { newFriends, removedFriends };
  } catch (err) {
    console.error("❌ syncFriendsWithCache error:", err);
    return { newFriends: [], removedFriends: [] };
  }
};

// Thêm 1 bạn mới vào cache (cả ID và detail)
export const addFriendToCache = async (friend) => {
  try {
    if (!friend?.uid) return;
    // lưu ID
    await friendDB.friendIds.put({
      uid: friend.uid,
      createdAt: friend.createdAt || Date.now(),
    });
    // lưu chi tiết
    await friendDB.friendDetails.put(friend);
    console.log("✅ Đã thêm bạn mới vào cache:", friend.uid);
  } catch (err) {
    console.error("❌ Lỗi khi thêm bạn mới:", err);
  }
};

// Xoá 1 bạn mới khỏi cache (cả ID và detail)
export const removeFriendToCache = async (uid) => {
  try {
    if (!uid) return;
    // lưu ID
    await friendDB.friendIds.delete(uid);
    // lưu chi tiết
    await friendDB.friendDetails.delete(uid);
    console.log("✅ Đã xoá bạn mới khỏi cache:", uid);
  } catch (err) {
    console.error("❌ Lỗi khi xoá bạn:", err);
  }
};