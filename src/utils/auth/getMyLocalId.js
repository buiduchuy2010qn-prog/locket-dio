import { getToken } from "@/utils/storage/storage";

/**
 * ID acc đang login (Locket/Dio = localId).
 * Không dùng user.uid — field này thường không có sau login.
 */
export function getMyLocalId(user = null, authTokens = null) {
  return (
    user?.localId ||
    user?.uid ||
    authTokens?.localId ||
    getToken()?.localId ||
    localStorage.getItem("localId") ||
    sessionStorage.getItem("localId") ||
    null
  );
}

/** Moment có phải của acc đang login không */
export function isMyMoment(moment, myId) {
  if (!moment || !myId) return false;
  const owner =
    moment.user ||
    moment.userUid ||
    moment.owner ||
    moment.owner_uid ||
    moment.uid ||
    null;
  return owner === myId;
}
