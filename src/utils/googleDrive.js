/**
 * Shared Google Drive backup — 1 Drive cho cả web, cấu hình server (admin).
 * Client chỉ POST file lên /api/drive-backup khi server đã bật.
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

/** Status từ server (cache 60s) */
export async function fetchDriveServerStatus(force = false) {
  try {
    if (!force) {
      const at = Number(localStorage.getItem(STATUS_CACHE_AT) || 0);
      const cached = localStorage.getItem(STATUS_CACHE_KEY);
      if (cached && Date.now() - at < 60_000) {
        return JSON.parse(cached);
      }
    }
    const res = await fetch("/api/drive-status", { method: "GET" });
    const data = await res.json().catch(() => ({}));
    localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(STATUS_CACHE_AT, String(Date.now()));
    return data;
  } catch {
    return { configured: false, enabled: false };
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

/** Auto backup = server đã cấu hình (1 Drive cho cả site) */
export function isDriveAutoBackupEnabled() {
  return isDriveConfigured();
}

export function setDriveAutoBackupEnabled() {
  /* no-op — admin cấu hình qua env server */
}

export function isDriveConnected() {
  return isDriveConfigured();
}

export function getDriveEmail() {
  try {
    const cached = localStorage.getItem(STATUS_CACHE_KEY);
    if (cached) return JSON.parse(cached)?.folderHint || "Shared Drive (admin)";
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
      "Admin chưa cấu hình Google Drive trên server (GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_DRIVE_FOLDER_ID)."
    );
  }
  return true;
}

/**
 * Upload file lên Drive chung của web (server service account).
 */
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

/**
 * Fire-and-forget backup sau khi upload R2.
 * Chỉ chạy khi server đã bật Drive (1 Drive cho cả web).
 */
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
