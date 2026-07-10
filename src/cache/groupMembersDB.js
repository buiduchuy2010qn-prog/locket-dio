import db from "./configDB";

export const putMemberInfo = async (user) => {
  if (!user?.uid) return;
  try {
    await db.groupMembersDetail.put(user);
  } catch (err) {
    console.error("Error saving user info to cache:", err);
  }
};

export const getMemberInfo = async (uid) => {
  if (!uid) return null;
  try {
    return (await db.groupMembersDetail.get(uid)) || null;
  } catch (err) {
    console.error("Error getting user info from cache:", err);
    return null;
  }
};

export const getAllMemberInfo = async () => {
  try {
    return await db.groupMembersDetail.toArray();
  } catch (err) {
    console.error("Error getting all user info from cache:", err);
    return [];
  }
};

export const deleteMemberInfo = async (uid) => {
  if (!uid) return;
  try {
    await db.groupMembersDetail.delete(uid);
  } catch (err) {
    console.error("Error deleting user info from cache:", err);
  }
};
