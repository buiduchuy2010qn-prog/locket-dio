import { getToken } from "@/utils/storage/storage";

/**
 * Locket user ID thật = Firebase localId (user_uid trên api.locketcamera.com).
 * Ưu tiên token đã lưu sau login (localId từ Locket/Dio).
 */
export function getMyLocalId(user = null, authTokens = null) {
  // Token sau login Locket = nguồn chuẩn
  const fromToken =
    getToken()?.localId ||
    authTokens?.localId ||
    localStorage.getItem("localId") ||
    sessionStorage.getItem("localId") ||
    null;

  if (fromToken) return String(fromToken);

  // Fallback user object
  const fromUser =
    user?.localId ||
    user?.uid ||
    user?.user_uid ||
    user?.userUid ||
    null;

  return fromUser ? String(fromUser) : null;
}

/** Alias rõ nghĩa: Locket ID = localId */
export function getMyLocketId(user = null, authTokens = null) {
  return getMyLocalId(user, authTokens);
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
