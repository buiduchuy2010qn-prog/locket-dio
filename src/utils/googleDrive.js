/**
 * Shared Google Drive backup — 1 Drive cho cả web.
 * Chỉ admin (gmail) thấy UI liên kết trong Settings.
 */

const STATUS_CACHE_KEY = "gdrive_server_status";
const STATUS_CACHE_AT = "gdrive_server_status_at";

/** Gmail + Locket ID admin mặc định (có thể bổ sung qua env) */
const DEFAULT_ADMIN_EMAILS = ["buiduchuy2010qn@gmail.com"];
/** Locket ID thật (localId / user_uid) của admin */
const DEFAULT_ADMIN_LOCKET_IDS = ["y82fIv1QyDXLrMZ012MKYoYmAVz2"];

function normalizeEmail(v) {
  if (!v) return "";
  return String(v).trim().toLowerCase().replace(/\s+/g, "");
}

function parseList(raw) {
  return String(raw || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Danh sách email admin (env + mặc định) */
export function getAdminEmails() {
  const fromEnv = parseList(
    import.meta.env.VITE_ADMIN_EMAILS ||
      import.meta.env.VITE_ADMIN_LOCAL_IDS ||
      localStorage.getItem("ADMIN_EMAILS") ||
      localStorage.getItem("ADMIN_LOCAL_IDS") ||
      ""
  ).map(normalizeEmail);

  const set = new Set([
    ...DEFAULT_ADMIN_EMAILS.map(normalizeEmail),
    ...fromEnv,
  ]);
  return Array.from(set);
}

/**
 * Kiểm tra admin theo email / username / localId.
 * @param {string|object|null} idOrUser - localId string HOẶC user object
 * @param {object|null} user - optional user { email, username, localId }
 */
export function isAdminUser(idOrUser = null, user = null) {
  const u =
    user ||
    (idOrUser && typeof idOrUser === "object" ? idOrUser : null);

  const emails = getAdminEmails();
  const ids = [
    ...DEFAULT_ADMIN_LOCKET_IDS,
    ...parseList(
      import.meta.env.VITE_ADMIN_LOCAL_IDS ||
        localStorage.getItem("ADMIN_LOCAL_IDS") ||
        ""
    ),
  ];

  const candidates = [];
  if (typeof idOrUser === "string" || typeof idOrUser === "number") {
    candidates.push(String(idOrUser));
  }
  if (u) {
    candidates.push(
      u.email,
      u.Email,
      u.mail,
      u.username,
      u.localId,
      u.uid,
      u.user_id,
      u.user_uid,
      u.userUid
    );
  }
  // fallback storage
  try {
    candidates.push(localStorage.getItem("email"));
    candidates.push(sessionStorage.getItem("email"));
    candidates.push(localStorage.getItem("localId"));
    candidates.push(sessionStorage.getItem("localId"));
  } catch {
    /* ignore */
  }

  for (const c of candidates) {
    if (!c) continue;
    const s = String(c).trim();
    const em = normalizeEmail(s);
    // so khớp email đầy đủ
    if (emails.includes(em)) return true;
    // so khớp phần trước @gmail (vd buiduchuy2010qn)
    const localPart = em.includes("@") ? em.split("@")[0] : em;
    if (
      emails.some((a) => a === localPart || a.split("@")[0] === localPart)
    ) {
      return true;
    }
    // Locket ID (localId) list
    if (ids.includes(s)) return true;
  }
  return false;
}

/** Status từ server (cache 60s) */
export async function fetchDriveServerStatus(
  force = false,
  localId = null,
  email = null
) {
  try {
    if (!force) {
      const at = Number(localStorage.getItem(STATUS_CACHE_AT) || 0);
      const cached = localStorage.getItem(STATUS_CACHE_KEY);
      if (cached && Date.now() - at < 60_000) {
        return JSON.parse(cached);
      }
    }
    const headers = {};
    if (localId) headers["X-Local-Id"] = String(localId);
    if (email) headers["X-User-Email"] = normalizeEmail(email);

    const res = await fetch("/api/drive-status", { method: "GET", headers });
    const data = await res.json().catch(() => ({}));
    data.isAdmin =
      Boolean(data.isAdmin) ||
      isAdminUser(localId, { email, localId });
    localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(STATUS_CACHE_AT, String(Date.now()));
    return data;
  } catch {
    return {
      configured: false,
      enabled: false,
      isAdmin: isAdminUser(localId, { email, localId }),
    };
  }
}

export function isDriveConfigured() {
  try {
    const cached = localStorage.getItem(STATUS_CACHE_KEY);
    if (cached) return Boolean(JSON.parse(cached)?.configured);
  } catch {
    /* ignore */
  }
  return false;
}

export function isDriveAutoBackupEnabled() {
  return isDriveConfigured();
}

export function setDriveAutoBackupEnabled() {
  /* no-op */
}

export function isDriveConnected() {
  return isDriveConfigured();
}

export function getDriveEmail() {
  try {
    const cached = localStorage.getItem(STATUS_CACHE_KEY);
    if (cached) return JSON.parse(cached)?.serviceEmail || "";
  } catch {
    /* ignore */
  }
  return "";
}

export function getGoogleClientId() {
  return "";
}

export function disconnectGoogleDrive() {
  localStorage.removeItem(STATUS_CACHE_KEY);
  localStorage.removeItem(STATUS_CACHE_AT);
}

export async function connectGoogleDrive() {
  const st = await fetchDriveServerStatus(true);
  if (!st?.configured) {
    throw new Error(
      "Admin chưa cấu hình Drive trên Render (GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_DRIVE_FOLDER_ID)."
    );
  }
  return true;
}

export async function uploadFileToGoogleDrive(file, options = {}) {
  if (!file) throw new Error("Không có file");

  const name =
    options.fileName ||
    file.name ||
    `locketdio-${Date.now()}.${file.type?.includes("video") ? "mp4" : "jpg"}`;

  const buf = await file.arrayBuffer();
  const res = await fetch("/api/drive-backup", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Filename": encodeURIComponent(name),
      "X-Upload-Size": String(buf.byteLength),
    },
    body: buf,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Drive backup failed (${res.status})`);
  }
  return data;
}

export function backupToDriveInBackground(file, meta = {}) {
  if (!file) return;

  (async () => {
    try {
      const st = await fetchDriveServerStatus(false);
      if (!st?.configured || st?.enabled === false) return;

      const result = await uploadFileToGoogleDrive(file, {
        fileName: meta.fileName,
      });
      console.log("[gdrive] shared backup OK", result?.id, result?.name);
      if (typeof meta.onSuccess === "function") meta.onSuccess(result);
    } catch (err) {
      console.warn("[gdrive] backup skipped:", err?.message || err);
      if (typeof meta.onError === "function") meta.onError(err);
    }
  })();
}
