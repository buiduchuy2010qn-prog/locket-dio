/** Lấy localId / uid user Locket từ user object hoặc storage */
export function getMyLocalId(user = null, authTokens = null) {
  const fromUser =
    user?.localId ||
    user?.uid ||
    user?.user_uid ||
    user?.userUid ||
    user?.user_id ||
    user?.id ||
    null;
  if (fromUser) return String(fromUser);

  try {
    return (
      localStorage.getItem("localId") ||
      sessionStorage.getItem("localId") ||
      authTokens?.localId ||
      authTokens?.user_id ||
      ""
    );
  } catch {
    return "";
  }
}
