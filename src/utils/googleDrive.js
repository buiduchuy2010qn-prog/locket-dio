/**
 * Shared Google Drive backup — 1 Drive cho cả web.
 * Chỉ admin thấy UI liên kết (Settings). Cấu hình qua env Render.
 */

const STATUS_CACHE_KEY = "gdrive_server_status";
const STATUS_CACHE_AT = "gdrive_server_status_at";

export function isAdminUser(localId) {
  if (!localId) return false;
  const raw =
    import.meta.env.VITE_ADMIN_LOCAL_IDS ||
    localStorage.getItem("ADMIN_LOCAL_IDS") ||
    "";
  const ids = String(raw)
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(String(localId));
}

/** Status từ server (cache 60s). Gửi localId để server trả isAdmin. */
export async function fetchDriveServerStatus(force = false, localId = null) {
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
    const res = await fetch("/api/drive-status", { method: "GET", headers });
    const data = await res.json().catch(() => ({}));
    // isAdmin = server OR client env (build-time VITE_ADMIN_LOCAL_IDS)
    data.isAdmin = Boolean(data.isAdmin) || isAdminUser(localId);
    localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(STATUS_CACHE_AT, String(Date.now()));
    return data;
  } catch {
    return {
      configured: false,
      enabled: false,
      isAdmin: isAdminUser(localId),
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
  /* no-op — admin cấu hình env server */
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

/** Backup nền sau đăng — mọi user, 1 Drive chung nếu server bật */
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
