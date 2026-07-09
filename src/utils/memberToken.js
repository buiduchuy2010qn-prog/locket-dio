const TOKEN_KEY = "memberToken";
const HEADER_KEY = "memberHeader";
const DEFAULT_HEADER = "X-LocketDio-Member";

/** Lưu member session từ API Dio (bắt buộc cho storage/upload) */
export function saveMemberSession(session) {
  if (!session || typeof session !== "object") return;
  // Official only checks session.member_token; keep aliases as fallback
  const token =
    session.member_token ||
    session.memberToken ||
    session.session?.member_token ||
    session.session?.memberToken ||
    null;
  if (!token || typeof token !== "string") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(
    HEADER_KEY,
    session.header ||
      session.memberHeader ||
      session.session?.header ||
      DEFAULT_HEADER
  );
}

/** Lấy member token để gắn header request */
export function getMemberSession() {
  return {
    token: localStorage.getItem(TOKEN_KEY),
    header: localStorage.getItem(HEADER_KEY) || DEFAULT_HEADER,
  };
}

export function clearMemberSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(HEADER_KEY);
}

/** Gắn vào axios config.headers */
export function applyMemberHeader(headers = {}) {
  const { token, header } = getMemberSession();
  if (token && header) {
    headers[header] = token;
  }
  return headers;
}
