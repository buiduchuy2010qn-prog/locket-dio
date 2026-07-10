/**
 * Spotify user OAuth (PKCE) — liên kết tài khoản người dùng trên web.
 * Token lưu localStorage theo localId (mỗi user 1 session).
 */

const STORAGE_PREFIX = "huylocket_spotify_";
const SCOPES = [
  "user-read-currently-playing",
  "user-read-recently-played",
  "user-read-playback-state",
  "user-top-read",
].join(" ");

function storageKey(localId = "guest") {
  return `${STORAGE_PREFIX}${localId || "guest"}`;
}

function getClientId() {
  return (
    import.meta.env.VITE_SPOTIFY_CLIENT_ID ||
    import.meta.env.VITE_SPOTIFY_CLIENTID ||
    // Fallback production Huy Locket (public Client ID)
    "1f89199367264178a0b8c66d7e74c1d6"
  ).trim();
}

export function getSpotifyRedirectUri() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/spotify/callback`;
}

export function isSpotifyClientConfigured() {
  return Boolean(getClientId());
}

export function getSpotifyClientId() {
  return getClientId();
}

function loadStore(localId) {
  try {
    const raw = localStorage.getItem(storageKey(localId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveStore(localId, data) {
  try {
    localStorage.setItem(storageKey(localId), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearSpotifyUserAuth(localId) {
  try {
    localStorage.removeItem(storageKey(localId));
    sessionStorage.removeItem("spotify_pkce_verifier");
    sessionStorage.removeItem("spotify_pkce_state");
    sessionStorage.removeItem("spotify_oauth_localId");
  } catch {
    /* ignore */
  }
}

export function getSpotifyUserProfile(localId) {
  const s = loadStore(localId);
  return s?.profile || null;
}

export function isSpotifyUserLinked(localId) {
  const s = loadStore(localId);
  return Boolean(s?.refresh_token || s?.access_token);
}

function base64UrlEncode(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let str = "";
  bytes.forEach((b) => {
    str += String.fromCharCode(b);
  });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

function randomString(len = 64) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (x) => chars[x % chars.length]).join("");
}

/**
 * Bắt đầu OAuth PKCE — redirect sang Spotify.
 */
export async function startSpotifyUserLogin(localId = "guest") {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error(
      "Chưa cấu hình VITE_SPOTIFY_CLIENT_ID. Admin thêm Client ID Spotify (Dashboard → App → Redirect URI).",
    );
  }

  const verifier = randomString(64);
  const state = randomString(16);
  const challenge = base64UrlEncode(await sha256(verifier));

  sessionStorage.setItem("spotify_pkce_verifier", verifier);
  sessionStorage.setItem("spotify_pkce_state", state);
  sessionStorage.setItem("spotify_oauth_localId", localId || "guest");
  sessionStorage.setItem(
    "spotify_oauth_return",
    window.location.pathname + window.location.search,
  );

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getSpotifyRedirectUri(),
    scope: SCOPES,
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
    show_dialog: "false",
  });

  window.location.assign(
    `https://accounts.spotify.com/authorize?${params.toString()}`,
  );
}

/**
 * Xử lý callback /spotify/callback?code=&state=
 */
export async function completeSpotifyUserLogin(searchParams) {
  const clientId = getClientId();
  if (!clientId) throw new Error("Thiếu VITE_SPOTIFY_CLIENT_ID");

  const err = searchParams.get("error");
  if (err) throw new Error(err);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = sessionStorage.getItem("spotify_pkce_state");
  const verifier = sessionStorage.getItem("spotify_pkce_verifier");
  const localId = sessionStorage.getItem("spotify_oauth_localId") || "guest";

  if (!code || !verifier) throw new Error("Thiếu mã OAuth Spotify");
  if (state && savedState && state !== savedState) {
    throw new Error("State OAuth không khớp — thử liên kết lại");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: getSpotifyRedirectUri(),
    code_verifier: verifier,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Token exchange failed");
  }

  const expiresAt = Date.now() + (Number(data.expires_in) || 3600) * 1000 - 30_000;
  let profile = null;
  try {
    const pr = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (pr.ok) profile = await pr.json();
  } catch {
    /* optional */
  }

  saveStore(localId, {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
    token_type: data.token_type || "Bearer",
    scope: data.scope || SCOPES,
    profile: profile
      ? {
          id: profile.id,
          display_name: profile.display_name,
          email: profile.email,
          image: profile.images?.[0]?.url || null,
        }
      : null,
    updated_at: Date.now(),
  });

  sessionStorage.removeItem("spotify_pkce_verifier");
  sessionStorage.removeItem("spotify_pkce_state");

  return {
    localId,
    profile: loadStore(localId)?.profile || null,
    returnTo: sessionStorage.getItem("spotify_oauth_return") || "/locket",
  };
}

async function refreshAccessToken(localId, store) {
  const clientId = getClientId();
  if (!clientId || !store?.refresh_token) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: store.refresh_token,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    clearSpotifyUserAuth(localId);
    throw new Error(data.error_description || "Spotify session hết hạn — liên kết lại");
  }

  const next = {
    ...store,
    access_token: data.access_token,
    refresh_token: data.refresh_token || store.refresh_token,
    expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000 - 30_000,
    updated_at: Date.now(),
  };
  saveStore(localId, next);
  return next.access_token;
}

/**
 * Lấy access token hợp lệ (auto refresh).
 */
export async function getSpotifyAccessToken(localId = "guest") {
  let store = loadStore(localId);
  if (!store?.access_token && !store?.refresh_token) return null;

  if (store.expires_at && Date.now() < store.expires_at && store.access_token) {
    return store.access_token;
  }

  if (store.refresh_token) {
    return refreshAccessToken(localId, store);
  }
  return null;
}
