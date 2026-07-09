/**
 * Google Drive backup (client-side OAuth + Drive API v3).
 * Folder: "Locket Dio" trên Drive của user.
 *
 * Cần VITE_GOOGLE_CLIENT_ID (OAuth 2.0 Web client).
 * Origins: https://huy-locket.onrender.com + http://localhost:5173
 */

const FOLDER_NAME = "Locket Dio";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const STORAGE_TOKEN = "gdrive_access_token";
const STORAGE_EXP = "gdrive_token_exp";
const STORAGE_AUTO = "gdrive_auto_backup";
const STORAGE_FOLDER = "gdrive_folder_id";
const STORAGE_EMAIL = "gdrive_email";

export function getGoogleClientId() {
  return (
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    localStorage.getItem("VITE_GOOGLE_CLIENT_ID") ||
    ""
  ).trim();
}

export function isDriveConfigured() {
  return Boolean(getGoogleClientId());
}

export function isDriveAutoBackupEnabled() {
  return localStorage.getItem(STORAGE_AUTO) === "true";
}

export function setDriveAutoBackupEnabled(on) {
  localStorage.setItem(STORAGE_AUTO, on ? "true" : "false");
}

export function isDriveConnected() {
  const token = localStorage.getItem(STORAGE_TOKEN);
  const exp = Number(localStorage.getItem(STORAGE_EXP) || 0);
  return Boolean(token && exp > Date.now() + 30_000);
}

export function getDriveEmail() {
  return localStorage.getItem(STORAGE_EMAIL) || "";
}

export function disconnectGoogleDrive() {
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_EXP);
  localStorage.removeItem(STORAGE_FOLDER);
  localStorage.removeItem(STORAGE_EMAIL);
}

function saveToken(accessToken, expiresInSec = 3600) {
  localStorage.setItem(STORAGE_TOKEN, accessToken);
  localStorage.setItem(
    STORAGE_EXP,
    String(Date.now() + Math.max(60, expiresInSec - 60) * 1000)
  );
}

function getStoredToken() {
  if (!isDriveConnected()) return null;
  return localStorage.getItem(STORAGE_TOKEN);
}

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-gis="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Không tải được Google Identity Services"))
      );
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.dataset.gis = "1";
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error("Không tải được Google Identity Services"));
    document.head.appendChild(s);
  });
}

/**
 * Xin quyền Drive (popup Google).
 * @param {{ prompt?: string }} opts prompt: '' silent | 'consent' force
 */
export async function connectGoogleDrive(opts = {}) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      "Chưa cấu hình Google Client ID. Thêm VITE_GOOGLE_CLIENT_ID vào env (Render) hoặc Settings."
    );
  }

  await loadGisScript();

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: async (resp) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
            return;
          }
          saveToken(resp.access_token, resp.expires_in || 3600);
          try {
            const me = await fetch(
              "https://www.googleapis.com/drive/v3/about?fields=user",
              {
                headers: { Authorization: `Bearer ${resp.access_token}` },
              }
            ).then((r) => r.json());
            if (me?.user?.emailAddress) {
              localStorage.setItem(STORAGE_EMAIL, me.user.emailAddress);
            }
          } catch {
            /* ignore */
          }
          // Bật auto backup khi connect thành công
          setDriveAutoBackupEnabled(true);
          resolve(resp.access_token);
        },
        error_callback: (err) => {
          reject(new Error(err?.message || "Huỷ đăng nhập Google Drive"));
        },
      });

      tokenClient.requestAccessToken({
        prompt: opts.prompt ?? "consent",
      });
    } catch (e) {
      reject(e);
    }
  });
}

/** Lấy token — silent nếu đã cấp quyền, popup nếu cần */
async function ensureAccessToken({ interactive = true } = {}) {
  const existing = getStoredToken();
  if (existing) return existing;

  if (!interactive) return null;

  return connectGoogleDrive({ prompt: "" });
}

async function driveFetch(path, options = {}) {
  const token = await ensureAccessToken({ interactive: options.interactive !== false });
  if (!token) throw new Error("Chưa kết nối Google Drive");

  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    disconnectGoogleDrive();
    if (options.interactive === false) {
      throw new Error("Token Drive hết hạn");
    }
    const newToken = await connectGoogleDrive({ prompt: "" });
    const retry = await fetch(`https://www.googleapis.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${newToken}`,
        ...(options.headers || {}),
      },
    });
    if (!retry.ok) {
      const t = await retry.text().catch(() => "");
      throw new Error(`Drive API ${retry.status}: ${t.slice(0, 200)}`);
    }
    return retry;
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Drive API ${res.status}: ${t.slice(0, 200)}`);
  }
  return res;
}

async function ensureLocketFolder(interactive = true) {
  const cached = localStorage.getItem(STORAGE_FOLDER);
  if (cached) return cached;

  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const listRes = await driveFetch(
    `/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=5`,
    { interactive }
  );
  const list = await listRes.json();
  if (list.files?.[0]?.id) {
    localStorage.setItem(STORAGE_FOLDER, list.files[0].id);
    return list.files[0].id;
  }

  const createRes = await driveFetch("/drive/v3/files", {
    method: "POST",
    interactive,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const created = await createRes.json();
  if (!created.id) throw new Error("Không tạo được folder Drive");
  localStorage.setItem(STORAGE_FOLDER, created.id);
  return created.id;
}

/**
 * Upload File/Blob lên folder Locket Dio.
 * @returns {{ id: string, webViewLink?: string, name: string }}
 */
export async function uploadFileToGoogleDrive(file, options = {}) {
  if (!file) throw new Error("Không có file để backup Drive");

  const interactive = options.interactive !== false;
  const folderId = await ensureLocketFolder(interactive);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const ext =
    (file.name && file.name.includes(".") && file.name.split(".").pop()) ||
    (file.type?.includes("video") ? "mp4" : "jpg");
  const name =
    options.fileName ||
    file.name ||
    `locketdio-${timestamp}.${ext}`;

  const metadata = {
    name,
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append(
    "file",
    file instanceof Blob
      ? file
      : new Blob([file], { type: file.type || "application/octet-stream" }),
    name
  );

  const token = await ensureAccessToken({ interactive });
  if (!token) throw new Error("Chưa kết nối Google Drive");

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (res.status === 401) {
    disconnectGoogleDrive();
    if (!interactive) throw new Error("Token Drive hết hạn");
    await connectGoogleDrive({ prompt: "" });
    return uploadFileToGoogleDrive(file, { ...options, interactive: false });
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Upload Drive thất bại (${res.status}): ${t.slice(0, 180)}`);
  }

  return res.json();
}

/**
 * Backup sau khi upload R2 / đăng Locket.
 * Không chặn luồng chính — fire-and-forget an toàn.
 * Chỉ chạy nếu auto-backup bật + đã từng connect.
 */
export function backupToDriveInBackground(file, meta = {}) {
  if (!file) return;
  if (!isDriveConfigured()) return;
  if (!isDriveAutoBackupEnabled()) return;
  // Chỉ auto nếu đã có token (user đã connect) — không bật popup giữa lúc đăng
  if (!getStoredToken() && !isDriveConnected()) {
    // Thử silent: nếu token hết hạn nhưng cookie Google còn → có thể fail silently
    return;
  }

  // Không await — tránh làm chậm post Locket
  (async () => {
    try {
      const result = await uploadFileToGoogleDrive(file, {
        interactive: false,
        fileName: meta.fileName,
      });
      console.log("[gdrive] backup OK", result?.id, result?.name);
      if (typeof meta.onSuccess === "function") meta.onSuccess(result);
    } catch (err) {
      console.warn("[gdrive] backup skipped/failed:", err?.message || err);
      if (typeof meta.onError === "function") meta.onError(err);
    }
  })();
}
