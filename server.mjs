/**
 * Huy Locket static + API proxy
 * Browser → same origin → this server → api.locket-dio.com / storage.locket-dio.com
 * Shared Google Drive backup (1 Drive for whole site, admin env only)
 */
import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = path.join(__dirname, "public");

const PROXIES = [
  { prefix: "/dio-api", target: "https://api.locket-dio.com" },
  { prefix: "/dio-auth", target: "https://auth.locket-dio.com" },
  { prefix: "/dio-data", target: "https://data.locket-dio.com" },
  { prefix: "/dio-storage", target: "https://storage.locket-dio.com" },
  { prefix: "/dio-media", target: "https://media.locket-dio.com" },
  { prefix: "/dio-export", target: "https://export.locket-dio.com" },
  { prefix: "/dio-cdn", target: "https://cdn.locket-dio.com" },
  { prefix: "/dio-payment", target: "https://payment.locket-dio.com" },
];

const ALLOWED_ORIGIN_SPOOF = "https://locket-dio.com";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".webp": "image/webp",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split("?")[0]);
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(root, clean);
  if (!full.startsWith(root)) return null;
  return full;
}

function serveStatic(req, res) {
  let urlPath = req.url.split("?")[0] || "/";
  if (urlPath === "/") urlPath = "/index.html";

  let filePath = safeJoin(PUBLIC_DIR, urlPath);
  if (!filePath) return send(res, 403, "Forbidden");

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    return send(res, 404, "Not found");
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const data = fs.readFileSync(filePath);
  const cache =
    ext === ".html" || ext === ".webmanifest" || path.basename(filePath) === "sw.js"
      ? "no-cache"
      : "public, max-age=31536000, immutable";

  send(res, 200, data, {
    "Content-Type": type,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
  });
}

function matchProxy(urlPath) {
  for (const p of PROXIES) {
    if (urlPath === p.prefix || urlPath.startsWith(p.prefix + "/")) {
      const rest = urlPath.slice(p.prefix.length) || "/";
      return { ...p, rest: rest.startsWith("/") ? rest : `/${rest}` };
    }
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ===== Shared Google Drive — OAuth + lưu Neon (bền, không mất khi redeploy) =====
// Priority: env > Neon DB > file local
const GDRIVE_CONFIG_PATH = path.join(__dirname, "data", "gdrive-config.json");
const GDRIVE_OAUTH_SCOPE = "https://www.googleapis.com/auth/drive.file";
// State OAuth ký HMAC — không phụ thuộc RAM (Render restart không làm “Hết hạn”)
const OAUTH_STATE_SECRET =
  process.env.OAUTH_STATE_SECRET ||
  process.env.DATABASE_URL ||
  "locket-dio-oauth-state-huy";

function signOauthState(payload) {
  const body = b64url(
    JSON.stringify({
      ...payload,
      exp: Date.now() + 60 * 60_000, // 60 phút
    })
  );
  const sig = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function verifyOauthState(state) {
  if (!state || !String(state).includes(".")) return null;
  const [body, sig] = String(state).split(".");
  if (!body || !sig) return null;
  const expect = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(body)
    .digest("base64url");
  // timing-safe compare
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const json = Buffer.from(
      body.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
    const data = JSON.parse(json);
    if (!data?.exp || data.exp < Date.now()) return null;
    if (!data.clientId || !data.clientSecret) return null;
    return data;
  } catch {
    return null;
  }
}
// Neon project huy-locket-drive — bền qua redeploy free
const NEON_FALLBACK_URL =
  "postgresql://neondb_owner:npg_Wd4gbkpS2JCa@ep-rough-math-atpq3c8p-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";

/** Chọn URL Neon hợp lệ (env Render hay thiếu @ thì dùng fallback) */
function resolveDatabaseUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.NEON_DATABASE_URL,
    NEON_FALLBACK_URL,
  ];
  for (const raw of candidates) {
    const u = String(raw || "").trim();
    if (!u) continue;
    // URL sai thường dính password@host thành passwordhost
    if (!u.includes("@") || !u.startsWith("postgres")) {
      console.warn("[gdrive] skip invalid DATABASE_URL (missing @ or scheme)");
      continue;
    }
    return u;
  }
  return NEON_FALLBACK_URL;
}

const DATABASE_URL = resolveDatabaseUrl();

/** @type {null | { folderId?: string, oauth?: object, serviceAccount?: object, updatedAt?: string, updatedBy?: string, source?: string }} */
let driveConfigMemory = null;
let neonReady = false;
let neonSql = null;

async function initNeon() {
  if (neonReady && neonSql) return true;
  // Luôn ưu tiên URL Neon đã biết (tránh env Render sai làm hỏng lưu)
  const urls = [NEON_FALLBACK_URL, DATABASE_URL].filter(
    (u, i, a) => u && a.indexOf(u) === i
  );
  for (const url of urls) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(url);
      await sql`
        CREATE TABLE IF NOT EXISTS gdrive_config (
          id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
          folder_id TEXT,
          oauth_client_id TEXT,
          oauth_client_secret TEXT,
          oauth_refresh_token TEXT,
          oauth_email TEXT,
          service_account_json JSONB,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          updated_by TEXT
        )
      `;
      neonSql = sql;
      neonReady = true;
      console.log("[gdrive] Neon config store: ON");
      return true;
    } catch (e) {
      console.warn("[gdrive] Neon init try failed:", e.message);
    }
  }
  neonReady = false;
  neonSql = null;
  return false;
}

/** Tìm hoặc tạo folder gốc "Huy Locket Web" trên Drive của user OAuth */
async function ensureRootBackupFolder(token, preferredId) {
  // 1) Thử folder ID form (nếu còn)
  if (preferredId && String(preferredId).length >= 10) {
    try {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
          preferredId
        )}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const meta = await metaRes.json().catch(() => ({}));
      if (
        metaRes.ok &&
        meta.id &&
        !meta.trashed &&
        String(meta.mimeType || "").includes("folder")
      ) {
        return { id: meta.id, name: meta.name || "Huy Locket Web", created: false };
      }
    } catch {
      /* fall through */
    }
  }

  // 2) Tìm folder Huy Locket Web (hoặc tên cũ Locket Dio Web)
  for (const folderName of ["Huy Locket Web", "Locket Dio Web"]) {
    const q = [
      `name='${folderName}'`,
      "mimeType='application/vnd.google-apps.folder'",
      "trashed=false",
      "'root' in parents",
    ].join(" and ");
    const listUrl =
      "https://www.googleapis.com/drive/v3/files?" +
      new URLSearchParams({
        q,
        fields: "files(id,name)",
        pageSize: "5",
        spaces: "drive",
      }).toString();
    try {
      const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const listData = await listRes.json().catch(() => ({}));
      if (listRes.ok && listData.files?.[0]?.id) {
        return {
          id: listData.files[0].id,
          name: listData.files[0].name,
          created: false,
        };
      }
    } catch {
      /* try next name */
    }
  }

  // 3) Tạo folder mới trên My Drive
  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Huy Locket Web",
        mimeType: "application/vnd.google-apps.folder",
      }),
    }
  );
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !created.id) {
    throw new Error(
      created?.error?.message ||
        "Không tạo được folder Huy Locket Web trên Drive"
    );
  }
  return { id: created.id, name: created.name || "Huy Locket Web", created: true };
}

async function readDriveConfigFromNeon() {
  if (!(await initNeon()) || !neonSql) return null;
  try {
    const rows = await neonSql`SELECT * FROM gdrive_config WHERE id = 1 LIMIT 1`;
    const row = rows?.[0];
    if (!row) return null;
    const cfg = {
      folderId: row.folder_id || "",
      oauth: {
        clientId: row.oauth_client_id || "",
        clientSecret: row.oauth_client_secret || "",
        refreshToken: row.oauth_refresh_token || "",
        email: row.oauth_email || "",
      },
      serviceAccount: row.service_account_json || undefined,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
      source: "neon",
    };
    if (!cfg.oauth.clientId && !cfg.serviceAccount && !cfg.folderId) return null;
    return cfg;
  } catch (e) {
    console.warn("[gdrive] Neon read failed:", e.message);
    return null;
  }
}

async function writeDriveConfigToNeon(cfg) {
  if (!(await initNeon()) || !neonSql) {
    console.warn(
      "[gdrive] Neon write skipped — not ready. Check Docker has @neondatabase/serverless"
    );
    return false;
  }
  try {
    const folderId = String(cfg.folderId || "");
    const clientId = String(cfg.oauth?.clientId || "");
    const clientSecret = String(cfg.oauth?.clientSecret || "");
    const refreshToken = String(cfg.oauth?.refreshToken || "");
    const oauthEmail = String(cfg.oauth?.email || "");
    const updatedBy = String(cfg.updatedBy || "");

    if (!refreshToken) {
      console.warn("[gdrive] Neon write skipped — empty refresh token");
      return false;
    }

    await neonSql`
      INSERT INTO gdrive_config (
        id, folder_id, oauth_client_id, oauth_client_secret,
        oauth_refresh_token, oauth_email, updated_at, updated_by
      ) VALUES (
        1,
        ${folderId},
        ${clientId},
        ${clientSecret},
        ${refreshToken},
        ${oauthEmail},
        NOW(),
        ${updatedBy}
      )
      ON CONFLICT (id) DO UPDATE SET
        folder_id = EXCLUDED.folder_id,
        oauth_client_id = EXCLUDED.oauth_client_id,
        oauth_client_secret = EXCLUDED.oauth_client_secret,
        oauth_refresh_token = EXCLUDED.oauth_refresh_token,
        oauth_email = EXCLUDED.oauth_email,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `;

    // Xác nhận ngay
    const rows =
      await neonSql`SELECT LENGTH(oauth_refresh_token) AS n FROM gdrive_config WHERE id = 1`;
    const n = Number(rows?.[0]?.n || 0);
    if (n < 10) {
      console.error("[gdrive] Neon write verify failed, length=", n);
      return false;
    }
    console.log("[gdrive] Neon write OK, refresh token length=", n);
    return true;
  } catch (e) {
    console.error("[gdrive] Neon write failed:", e.message, e);
    return false;
  }
}

function readDriveConfigFile() {
  try {
    if (!fs.existsSync(GDRIVE_CONFIG_PATH)) return null;
    const raw = fs.readFileSync(GDRIVE_CONFIG_PATH, "utf8");
    const cfg = JSON.parse(raw);
    if (cfg?.serviceAccount?.private_key) {
      cfg.serviceAccount.private_key = String(
        cfg.serviceAccount.private_key
      ).replace(/\\n/g, "\n");
    }
    return cfg;
  } catch (e) {
    console.warn("[gdrive] read config file failed:", e.message);
    return null;
  }
}

function writeDriveConfigFileSync(cfg) {
  try {
    const dir = path.dirname(GDRIVE_CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(GDRIVE_CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
  } catch (e) {
    console.warn("[gdrive] file write:", e.message);
  }
}

/** Lưu memory + disk + Neon (bền qua redeploy) */
async function saveDriveConfig(cfg) {
  driveConfigMemory = { ...cfg, source: cfg.source || "neon" };
  writeDriveConfigFileSync(driveConfigMemory);
  const ok = await writeDriveConfigToNeon(driveConfigMemory);
  if (ok) driveConfigMemory.source = "neon";
  return ok;
}

/** @deprecated use saveDriveConfig — giữ sync wrapper cho chỗ cũ */
function writeDriveConfigFile(cfg) {
  driveConfigMemory = cfg;
  writeDriveConfigFileSync(cfg);
  writeDriveConfigToNeon(cfg)
    .then((ok) => {
      if (ok && driveConfigMemory) driveConfigMemory.source = "neon";
    })
    .catch(() => {});
}

/** Load config: memory → Neon → file (sync path uses cache; warm async) */
function readDriveConfig() {
  if (driveConfigMemory?.oauth?.refreshToken || driveConfigMemory?.folderId) {
    return driveConfigMemory;
  }
  const file = readDriveConfigFile();
  if (file) {
    driveConfigMemory = file;
    return file;
  }
  return driveConfigMemory;
}

async function warmDriveConfig() {
  const neonCfg = await readDriveConfigFromNeon();
  if (neonCfg?.oauth?.refreshToken || neonCfg?.folderId) {
    driveConfigMemory = { ...neonCfg, source: "neon" };
    writeDriveConfigFileSync(driveConfigMemory);
    return driveConfigMemory;
  }
  return readDriveConfig();
}

function parseServiceAccountJson(raw) {
  if (!raw || !String(raw).trim()) return null;
  try {
    let text = String(raw).trim();
    if (!text.startsWith("{")) {
      text = Buffer.from(text, "base64").toString("utf8");
    }
    const sa = JSON.parse(text);
    if (sa.private_key && typeof sa.private_key === "string") {
      sa.private_key = sa.private_key.replace(/\\n/g, "\n");
    }
    if (!sa.client_email || !sa.private_key) return null;
    return sa;
  } catch (e) {
    console.warn("[gdrive] invalid SA json:", e.message);
    return null;
  }
}

function loadServiceAccount() {
  const fromEnv = parseServiceAccountJson(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON || ""
  );
  if (fromEnv) return fromEnv;
  const cfg = readDriveConfig();
  if (cfg?.serviceAccount) return cfg.serviceAccount;
  return null;
}

/** OAuth client + refresh token (ưu tiên — ghi được Drive cá nhân) */
function loadOauthCreds() {
  const cfg = readDriveConfig();
  const clientId = (
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    cfg?.oauth?.clientId ||
    ""
  ).trim();
  const clientSecret = (
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
    cfg?.oauth?.clientSecret ||
    ""
  ).trim();
  const refreshToken = (
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN ||
    cfg?.oauth?.refreshToken ||
    ""
  ).trim();
  const email = (cfg?.oauth?.email || "").trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, refreshToken, email };
}

function getDriveFolderId() {
  const fromEnv = (process.env.GOOGLE_DRIVE_FOLDER_ID || "").trim();
  if (fromEnv) return fromEnv;
  const cfg = readDriveConfig();
  return (cfg?.folderId || "").trim();
}

function normalizeFolderId(raw) {
  return String(raw || "")
    .trim()
    .replace(/^.*\/folders\//, "")
    .replace(/[?#].*$/, "");
}

function publicBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https")
    .toString()
    .split(",")[0]
    .trim();
  const host = (
    req.headers["x-forwarded-host"] ||
    req.headers.host ||
    "localhost"
  )
    .toString()
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

/** Drive “sẵn sàng backup” = có folder + OAuth refresh (SA chỉ cảnh báo) */
function isDriveReady() {
  const folderId = getDriveFolderId();
  const oauth = loadOauthCreds();
  return Boolean(folderId && oauth?.refreshToken);
}

function driveAuthMode() {
  const oauth = loadOauthCreds();
  if (oauth?.refreshToken) return "oauth";
  if (loadServiceAccount()) return "service_account";
  return "none";
}

let gdriveTokenCache = { token: null, exp: 0, mode: null };

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessTokenFromRefresh(oauth) {
  const body = new URLSearchParams({
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    refresh_token: oauth.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "OAuth refresh token failed"
    );
  }
  return data;
}

async function getAccessTokenFromServiceAccount(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: GDRIVE_OAUTH_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const signature = sign
    .sign(sa.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = `${unsigned}.${signature}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Google SA token failed"
    );
  }
  return data;
}

/** Ưu tiên OAuth user (Drive cá nhân), fallback SA (Shared Drive / Workspace) */
async function getGoogleAccessToken() {
  if (gdriveTokenCache.token && Date.now() < gdriveTokenCache.exp - 60_000) {
    return gdriveTokenCache.token;
  }

  const oauth = loadOauthCreds();
  if (oauth?.refreshToken) {
    const data = await getAccessTokenFromRefresh(oauth);
    gdriveTokenCache = {
      token: data.access_token,
      exp: Date.now() + (data.expires_in || 3600) * 1000,
      mode: "oauth",
    };
    return data.access_token;
  }

  const sa = loadServiceAccount();
  if (sa) {
    const data = await getAccessTokenFromServiceAccount(sa);
    gdriveTokenCache = {
      token: data.access_token,
      exp: Date.now() + (data.expires_in || 3600) * 1000,
      mode: "service_account",
    };
    return data.access_token;
  }

  throw new Error(
    "Chưa liên kết Google. Admin: đăng nhập OAuth trên /admin/google-drive"
  );
}

/** Cache ID folder con Ảnh / Video trong root Drive */
const subfolderCache = { rootId: null, anh: null, video: null };

function isVideoMedia(contentType, filename, mediaHint) {
  const hint = String(mediaHint || "").toLowerCase();
  if (hint === "video" || hint === "image") return hint === "video";
  const ct = String(contentType || "").toLowerCase();
  if (ct.startsWith("video/")) return true;
  if (ct.startsWith("image/")) return false;
  const name = String(filename || "").toLowerCase();
  return /\.(mp4|webm|mov|m4v|3gp|avi|mkv)(\?|$)/i.test(name);
}

/**
 * Tìm hoặc tạo folder con trong parent (tên: Ảnh / Video).
 * @returns {Promise<string>} folder id
 */
async function ensureDriveSubfolder(token, parentId, folderName) {
  const q = [
    `name='${folderName.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
    `mimeType='application/vnd.google-apps.folder'`,
    `trashed=false`,
  ].join(" and ");

  const listUrl =
    "https://www.googleapis.com/drive/v3/files?" +
    new URLSearchParams({
      q,
      fields: "files(id,name)",
      pageSize: "5",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    }).toString();

  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const listData = await listRes.json().catch(() => ({}));
  if (listRes.ok && listData.files?.[0]?.id) {
    return listData.files[0].id;
  }

  // Tạo folder mới
  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    }
  );
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !created.id) {
    throw new Error(
      created?.error?.message ||
        `Không tạo được folder "${folderName}" trên Drive`
    );
  }
  return created.id;
}

/** Lấy parent ID: root/Ảnh hoặc root/Video */
async function resolveBackupParentId(token, contentType, filename, mediaHint) {
  const rootId = getDriveFolderId();
  if (!rootId) throw new Error("Thiếu Folder ID");

  const video = isVideoMedia(contentType, filename, mediaHint);
  const subName = video ? "Video" : "Ảnh";

  // Invalidate cache nếu đổi root folder
  if (subfolderCache.rootId !== rootId) {
    subfolderCache.rootId = rootId;
    subfolderCache.anh = null;
    subfolderCache.video = null;
  }

  if (video && subfolderCache.video) return subfolderCache.video;
  if (!video && subfolderCache.anh) return subfolderCache.anh;

  const id = await ensureDriveSubfolder(token, rootId, subName);
  if (video) subfolderCache.video = id;
  else subfolderCache.anh = id;
  return id;
}

/**
 * Upload file vào folder Ảnh hoặc Video (tự tạo nếu chưa có).
 * @param {Buffer} fileBuf
 * @param {string} contentType
 * @param {string} filename
 * @param {string} [mediaHint] "image" | "video"
 */
async function uploadToSharedDrive(fileBuf, contentType, filename, mediaHint) {
  const folderId = getDriveFolderId();
  if (!folderId) {
    const err = new Error("Drive not configured (thiếu Folder ID)");
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  if (!loadOauthCreds()?.refreshToken && !loadServiceAccount()) {
    const err = new Error("Drive not configured (chưa OAuth / SA)");
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  const token = await getGoogleAccessToken();
  const parentId = await resolveBackupParentId(
    token,
    contentType,
    filename,
    mediaHint
  );

  const boundary = "----LocketDioDrive" + Date.now();
  const meta = JSON.stringify({
    name: filename || `locketdio-${Date.now()}.bin`,
    parents: [parentId],
  });
  const preamble = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${meta}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${contentType || "application/octet-stream"}\r\n\r\n`,
    "utf8"
  );
  const closing = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const body = Buffer.concat([preamble, fileBuf, closing]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,parents",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Drive upload ${res.status}`;
    if (/storage quota|Service Accounts do not have storage/i.test(msg)) {
      throw new Error(
        "Service Account không ghi được Drive cá nhân. Vào /admin/google-drive → Đăng nhập Google (OAuth)."
      );
    }
    throw new Error(msg);
  }
  return {
    ...data,
    folder: isVideoMedia(contentType, filename, mediaHint) ? "Video" : "Ảnh",
  };
}

function corsJson(req, res, status, obj) {
  const origin = req.headers.origin || "*";
  send(res, status, JSON.stringify(obj), {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "content-type,authorization,x-filename,x-upload-size,x-media-type,x-local-id,x-user-email,x-email",
  });
}

function parseAdminList(raw) {
  return String(raw || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeEmail(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** Admin Gmail mặc định + env */
function getAdminEmails() {
  const defaults = ["buiduchuy2010qn@gmail.com"];
  const fromEnv = parseAdminList(
    process.env.ADMIN_EMAILS ||
      process.env.VITE_ADMIN_EMAILS ||
      ""
  ).map(normalizeEmail);
  return Array.from(new Set([...defaults.map(normalizeEmail), ...fromEnv]));
}

/** Locket ID thật (user_uid) admin mặc định + env */
function getAdminLocketIds() {
  const defaults = ["y82fIv1QyDXLrMZ012MKYoYmAVz2"];
  const fromEnv = parseAdminList(
    process.env.ADMIN_LOCAL_IDS ||
      process.env.VITE_ADMIN_LOCAL_IDS ||
      ""
  );
  return Array.from(new Set([...defaults, ...fromEnv]));
}

function isAdminRequest(req) {
  const emails = getAdminEmails();
  const ids = getAdminLocketIds();

  const localId = String(
    req.headers["x-local-id"] || req.headers["x-userid"] || ""
  ).trim();
  const email = normalizeEmail(
    req.headers["x-user-email"] || req.headers["x-email"] || ""
  );

  // Locket ID (localId / user_uid)
  if (localId && ids.includes(localId)) return true;
  if (email && emails.includes(email)) return true;

  // cho phép match phần trước @gmail
  const localPart = email.includes("@") ? email.split("@")[0] : email;
  if (
    localPart &&
    emails.some((a) => a === localPart || a.split("@")[0] === localPart)
  ) {
    return true;
  }
  return false;
}

async function handleDriveStatus(req, res) {
  if (req.method === "OPTIONS") {
    return corsJson(req, res, 204, {});
  }
  await warmDriveConfig();
  const sa = loadServiceAccount();
  const oauth = loadOauthCreds();
  const folderId = getDriveFolderId();
  const mode = driveAuthMode();
  const ready = isDriveReady();
  const hasAnyCreds = Boolean(folderId && (oauth?.refreshToken || sa));
  const isAdmin = isAdminRequest(req);
  const cfg = readDriveConfig();

  if (!isAdmin) {
    return corsJson(req, res, 200, {
      configured: ready,
      enabled: ready,
      isAdmin: false,
      adminOnly: true,
      message: ready
        ? "Auto Drive backup ON"
        : "Drive backup off",
    });
  }

  let warning = null;
  if (mode === "service_account" && !oauth?.refreshToken) {
    warning =
      "Service Account không ghi được Drive cá nhân — dùng OAuth.";
  }

  const source = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    ? "env-oauth"
    : process.env.GOOGLE_SERVICE_ACCOUNT_JSON
      ? "env-sa"
      : cfg?.source === "neon" || neonReady
        ? "neon"
        : cfg
          ? "file"
          : "none";

  return corsJson(req, res, 200, {
    configured: ready,
    enabled: ready,
    hasPartialConfig: hasAnyCreds && !ready,
    authMode: mode,
    isAdmin: true,
    adminOnly: true,
    folderId: folderId || null,
    folderHint: folderId ? `…${folderId.slice(-8)}` : null,
    folderUrl: folderId
      ? `https://drive.google.com/drive/folders/${folderId}`
      : null,
    serviceEmail: sa?.client_email || null,
    oauthEmail: oauth?.email || null,
    hasOauthClient: Boolean(oauth?.clientId && oauth?.clientSecret),
    hasRefreshToken: Boolean(oauth?.refreshToken),
    neon: neonReady,
    source,
    warning,
    message: ready
      ? "Auto backup Drive ON — ảnh→Ảnh, video→Video (lưu bền Neon/env)"
      : warning ||
        "Bật 1 lần OAuth — cấu hình lưu Neon nên không mất khi deploy.",
  });
}

/** Admin lưu OAuth client + Folder ID (chưa có refresh → cần /api/drive-oauth-start) */
async function handleDriveConfigSave(req, res) {
  if (req.method === "OPTIONS") {
    return corsJson(req, res, 204, {});
  }
  if (req.method !== "POST") {
    return corsJson(req, res, 405, { error: "Method not allowed" });
  }
  if (!isAdminRequest(req)) {
    return corsJson(req, res, 403, {
      error: "Chỉ admin mới cấu hình được Google Drive",
    });
  }

  let body;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw.toString("utf8") || "{}");
  } catch (e) {
    return corsJson(req, res, 400, { error: "JSON body không hợp lệ" });
  }

  const folderId = normalizeFolderId(body.folderId || "");
  const clientId = String(body.clientId || body.oauthClientId || "").trim();
  const clientSecret = String(
    body.clientSecret || body.oauthClientSecret || ""
  ).trim();
  const sa =
    typeof body.serviceAccount === "object"
      ? body.serviceAccount
      : parseServiceAccountJson(body.serviceAccountJson || body.json || "");

  await warmDriveConfig();
  const prev = readDriveConfig() || {};

  // Cho phép chỉ cập nhật folder / oauth client (giữ refresh token cũ)
  const nextOauth = {
    clientId: clientId || prev.oauth?.clientId || "",
    clientSecret: clientSecret || prev.oauth?.clientSecret || "",
    refreshToken: prev.oauth?.refreshToken || "",
    email: prev.oauth?.email || "",
  };

  if (body.refreshToken) {
    nextOauth.refreshToken = String(body.refreshToken).trim();
  }

  // Folder ID tuỳ chọn — OAuth xong server tự tạo "Huy Locket Web" nếu thiếu
  if (folderId && folderId.length > 0 && folderId.length < 10) {
    return corsJson(req, res, 400, {
      error: "Folder ID quá ngắn. Để trống để tự tạo folder, hoặc dán ID đúng.",
    });
  }

  // Cần OAuth client HOẶC SA
  if (!nextOauth.clientId && !sa && !prev.serviceAccount) {
    return corsJson(req, res, 400, {
      error:
        "Cần OAuth Client ID + Secret (khuyến nghị) hoặc Service Account JSON.",
    });
  }
  if (clientId && !clientSecret && !prev.oauth?.clientSecret) {
    return corsJson(req, res, 400, {
      error: "Thiếu OAuth Client Secret",
    });
  }

  try {
    const cfg = {
      folderId,
      oauth: nextOauth.clientId
        ? nextOauth
        : prev.oauth || undefined,
      serviceAccount: sa || prev.serviceAccount || undefined,
      updatedAt: new Date().toISOString(),
      updatedBy: String(
        req.headers["x-user-email"] || req.headers["x-local-id"] || "admin"
      ),
    };
    await saveDriveConfig(cfg);
    gdriveTokenCache = { token: null, exp: 0, mode: null };

    const ready = isDriveReady();
    return corsJson(req, res, 200, {
      ok: true,
      configured: ready,
      authMode: driveAuthMode(),
      folderId,
      folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
      hasOauthClient: Boolean(cfg.oauth?.clientId && cfg.oauth?.clientSecret),
      hasRefreshToken: Boolean(cfg.oauth?.refreshToken),
      needOauthLogin: Boolean(cfg.oauth?.clientId && !cfg.oauth?.refreshToken),
      neon: neonReady,
      message: ready
        ? "Drive đã sẵn sàng backup (lưu Neon)!"
        : cfg.oauth?.clientId
          ? "Đã lưu Client. Bấm Bật backup (OAuth) để cấp quyền Drive."
          : "Đã lưu. Dùng OAuth để backup Drive cá nhân.",
    });
  } catch (e) {
    return corsJson(req, res, 500, {
      error: "Không ghi được cấu hình: " + e.message,
    });
  }
}

/** Bắt đầu OAuth — redirect Google */
async function handleDriveOAuthStart(req, res) {
  if (req.method === "OPTIONS") {
    return corsJson(req, res, 204, {});
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return corsJson(req, res, 405, { error: "Method not allowed" });
  }
  if (!isAdminRequest(req)) {
    return corsJson(req, res, 403, { error: "Chỉ admin" });
  }

  let folderId = getDriveFolderId();
  let clientId = loadOauthCreds()?.clientId || "";
  let clientSecret = loadOauthCreds()?.clientSecret || "";

  if (req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw.toString("utf8") || "{}");
      if (body.folderId) folderId = normalizeFolderId(body.folderId);
      if (body.clientId) clientId = String(body.clientId).trim();
      if (body.clientSecret) clientSecret = String(body.clientSecret).trim();
      // Lưu tạm client + folder trước khi redirect
      if (clientId && clientSecret && folderId) {
        await warmDriveConfig();
        const prev = readDriveConfig() || {};
        await saveDriveConfig({
          ...prev,
          folderId,
          oauth: {
            clientId,
            clientSecret,
            refreshToken: prev.oauth?.refreshToken || "",
            email: prev.oauth?.email || "",
          },
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      /* ignore */
    }
  }

  if (!clientId || !clientSecret) {
    return corsJson(req, res, 400, {
      error: "Thiếu OAuth Client ID / Secret. Lưu form trước.",
    });
  }
  // folderId có thể rỗng → callback tự tạo "Huy Locket Web"

  // State ký — sống sót qua restart Render (không còn “Hết hạn” do mất RAM)
  const state = signOauthState({
    clientId,
    clientSecret,
    folderId: folderId || "",
  });

  const redirectUri = `${publicBaseUrl(req)}/api/drive-oauth-callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GDRIVE_OAUTH_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  if (req.method === "POST") {
    return corsJson(req, res, 200, { ok: true, url, redirectUri });
  }
  res.writeHead(302, { Location: url });
  res.end();
}

/** OAuth callback — lưu refresh_token */
async function handleDriveOAuthCallback(req, res) {
  const u = new URL(req.url || "/", "http://localhost");
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  const err = u.searchParams.get("error");

  const html = (title, msg, ok) => {
    send(
      res,
      ok ? 200 : 400,
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <style>body{font-family:system-ui;max-width:520px;margin:40px auto;padding:16px;line-height:1.5}
      .ok{color:#15803d}.err{color:#b91c1c}a{color:#2563eb}</style></head>
      <body><h1 class="${ok ? "ok" : "err"}">${title}</h1><p>${msg}</p>
      <p><a href="/admin/google-drive">← Về trang cấu hình Drive</a></p>
      <script>try{localStorage.removeItem("gdrive_server_status");localStorage.removeItem("gdrive_server_status_at")}catch(e){}</script>
      </body></html>`,
      { "Content-Type": "text/html; charset=utf-8" }
    );
  };

  if (err) {
    return html("OAuth thất bại", `Google trả lỗi: ${err}`, false);
  }

  let oauthCtx = verifyOauthState(state);
  if (!oauthCtx) {
    // Fallback: config đã lưu trước khi redirect Google
    await warmDriveConfig();
    const cfg = readDriveConfig();
    if (cfg?.oauth?.clientId && cfg?.oauth?.clientSecret && cfg?.folderId) {
      oauthCtx = {
        clientId: cfg.oauth.clientId,
        clientSecret: cfg.oauth.clientSecret,
        folderId: cfg.folderId,
      };
    }
  }
  if (!oauthCtx) {
    return html(
      "Hết hạn / thiếu state",
      "Vào /admin/google-drive → điền form → bấm <b>Bật auto backup</b> lại (làm liền 1 lần).",
      false
    );
  }

  if (!code) {
    return html("Thiếu code", "Google không trả authorization code.", false);
  }

  const redirectUri = `${publicBaseUrl(req)}/api/drive-oauth-callback`;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: oauthCtx.clientId,
        client_secret: oauthCtx.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.refresh_token) {
      const detail =
        tokenData.error_description ||
        tokenData.error ||
        "Không nhận được refresh_token (thử prompt=consent lại)";
      return html("Không lấy được token", detail, false);
    }

    // Lấy email user
    let email = "";
    try {
      const ui = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      const uj = await ui.json().catch(() => ({}));
      email = uj.email || "";
    } catch {
      /* ignore */
    }

    const prev = readDriveConfig() || {};
    gdriveTokenCache = {
      token: tokenData.access_token,
      exp: Date.now() + (tokenData.expires_in || 3600) * 1000,
      mode: "oauth",
    };

    // Tự tìm / tạo folder Huy Locket Web trên Drive Gmail vừa login
    let testMsg = "";
    let rootFolderId = oauthCtx.folderId || prev.folderId || "";
    try {
      const token = tokenData.access_token;
      const rootInfo = await ensureRootBackupFolder(token, rootFolderId);
      rootFolderId = rootInfo.id;
      await ensureDriveSubfolder(token, rootFolderId, "Ảnh");
      await ensureDriveSubfolder(token, rootFolderId, "Video");
      // Cập nhật folderId trước upload (uploadToSharedDrive dùng getDriveFolderId)
      driveConfigMemory = {
        ...(driveConfigMemory || prev || {}),
        folderId: rootFolderId,
        oauth: {
          clientId: oauthCtx.clientId,
          clientSecret: oauthCtx.clientSecret,
          refreshToken: tokenData.refresh_token,
          email,
        },
      };
      const test = await uploadToSharedDrive(
        Buffer.from(
          `Huy Locket backup test ${new Date().toISOString()}\n`,
          "utf8"
        ),
        "text/plain",
        `locket-test-${Date.now()}.txt`,
        "image"
      );
      testMsg =
        (rootInfo.created
          ? ` Đã tạo folder «${rootInfo.name}».`
          : ` Folder «${rootInfo.name}» OK.`) +
        ` Ảnh + Video sẵn sàng. File thử: ${test.name || test.id}.` +
        ` <a href="https://drive.google.com/drive/folders/${rootFolderId}" target="_blank">Mở Drive</a>`;
    } catch (e) {
      testMsg = ` Upload thử: ${e.message}`;
    }

    // Lưu Neon / file SAU khi có folder ID hợp lệ
    const savedOk = await saveDriveConfig({
      ...prev,
      folderId: rootFolderId || oauthCtx.folderId || prev.folderId,
      oauth: {
        clientId: oauthCtx.clientId,
        clientSecret: oauthCtx.clientSecret,
        refreshToken: tokenData.refresh_token,
        email,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: email || "oauth",
      source: "neon",
    });

    let neonOk = savedOk;
    let neonErr = "";
    try {
      const check = await readDriveConfigFromNeon();
      neonOk = Boolean(check?.oauth?.refreshToken);
      if (!neonOk) {
        // Thử ghi lại 1 lần
        await writeDriveConfigToNeon(driveConfigMemory || {});
        const check2 = await readDriveConfigFromNeon();
        neonOk = Boolean(check2?.oauth?.refreshToken);
      }
      if (!neonOk) neonErr = " (không đọc được refresh token từ Neon)";
    } catch (e) {
      neonOk = false;
      neonErr = " (" + (e.message || "read fail") + ")";
    }

    const usable = Boolean(tokenData.refresh_token && rootFolderId);

    return html(
      neonOk
        ? "✅ Đã bật auto backup Drive (vĩnh viễn)!"
        : usable
          ? "⚠️ Token OK — đang backup (Neon chưa chắc)"
          : "⚠️ Token OK nhưng folder lỗi",
      `Tài khoản: <b>${email || "OK"}</b>.${testMsg}
      <p style="margin-top:12px">Lưu Neon: <b>${neonOk ? "OK — deploy không mất" : "LỖI" + neonErr}</b>.</p>
      <p>Chụp ảnh/video → tự vào folder <b>Ảnh</b> / <b>Video</b>.</p>`,
      neonOk || usable
    );
  } catch (e) {
    return html("Lỗi", e.message || "OAuth callback failed", false);
  }
}

async function handleDriveBackup(req, res) {
  if (req.method === "OPTIONS") {
    return corsJson(req, res, 204, {});
  }
  if (req.method !== "POST") {
    return corsJson(req, res, 405, { error: "Method not allowed" });
  }
  await warmDriveConfig();
  if (!getDriveFolderId() || (!loadOauthCreds()?.refreshToken && !loadServiceAccount())) {
    return corsJson(req, res, 503, {
      error: "Drive backup chưa bật (admin cấu hình 1 lần).",
      configured: false,
    });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return corsJson(req, res, 400, { error: "Bad body: " + e.message });
  }
  if (!body?.length) {
    return corsJson(req, res, 400, { error: "Empty file" });
  }
  // Giới hạn 80MB
  if (body.length > 80 * 1024 * 1024) {
    return corsJson(req, res, 413, { error: "File too large (max 80MB)" });
  }

  let filename = "locketdio.bin";
  try {
    filename = decodeURIComponent(
      req.headers["x-filename"] || "locketdio.bin"
    );
  } catch {
    filename = String(req.headers["x-filename"] || "locketdio.bin");
  }
  // Chặn path traversal
  filename = path.basename(filename).replace(/[^\w.\-()+\s]/g, "_") || "locketdio.bin";
  const contentType = req.headers["content-type"] || "application/octet-stream";
  const mediaHint = String(
    req.headers["x-media-type"] || ""
  ).toLowerCase();

  try {
    const result = await uploadToSharedDrive(
      body,
      contentType,
      filename,
      mediaHint
    );
    console.log(
      "[gdrive] uploaded",
      result?.id,
      filename,
      "→",
      result?.folder,
      body.length
    );
    return corsJson(req, res, 200, {
      ok: true,
      id: result.id,
      name: result.name,
      webViewLink: result.webViewLink,
      folder: result.folder || null,
    });
  } catch (e) {
    console.error("[gdrive] upload failed:", e.message);
    return corsJson(req, res, 502, { error: e.message || "Drive upload failed" });
  }
}

/**
 * Browser cannot PUT directly to R2 (CORS only allows locket-dio.com).
 * Client sends file here; we PUT to the presigned uploadUrl server-side.
 * Header: X-Upload-Url = full presigned URL
 * Body: raw file bytes; Content-Type must match presign
 */
function isAllowedR2UploadUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return (
      h.endsWith(".r2.cloudflarestorage.com") ||
      h.endsWith(".cloudflarestorage.com") ||
      h.endsWith(".r2.dev") ||
      h === "storage.locket-dio.com" ||
      h.endsWith(".storage.locket-dio.com") ||
      h.endsWith(".amazonaws.com") ||
      h.includes("locket-dio")
    );
  } catch {
    return false;
  }
}

async function proxyR2Put(req, res) {
  if (req.method === "OPTIONS") {
    return send(res, 204, "", {
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Methods": "PUT,OPTIONS",
      "Access-Control-Allow-Headers":
        req.headers["access-control-request-headers"] ||
        "content-type,x-upload-url,x-upload-size",
      "Access-Control-Max-Age": "86400",
    });
  }

  if (req.method !== "PUT" && req.method !== "POST") {
    return send(res, 405, "Method not allowed");
  }

  // Ưu tiên query ?url= (tránh header dài bị proxy cắt) → header backup
  let uploadUrl = "";
  try {
    const u = new URL(req.url || "/", "http://localhost");
    uploadUrl = u.searchParams.get("url") || "";
  } catch {
    /* ignore */
  }
  if (!uploadUrl) {
    uploadUrl =
      req.headers["x-upload-url"] ||
      req.headers["x-r2-upload-url"] ||
      "";
  }

  if (!uploadUrl || !isAllowedR2UploadUrl(uploadUrl)) {
    return send(
      res,
      400,
      "Missing or invalid upload URL (query ?url= or X-Upload-Url; must be R2/storage presigned)"
    );
  }

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return send(res, 400, "Bad request body: " + e.message);
  }

  if (!body.length) {
    return send(res, 400, "Empty upload body");
  }

  const expectedSize = Number(req.headers["x-upload-size"] || 0);
  if (expectedSize > 0 && body.length !== expectedSize) {
    console.warn(
      "[r2-put] size mismatch body=%s expected=%s",
      body.length,
      expectedSize
    );
    // Không fail cứng — một số browser không set size đúng; vẫn PUT
  }

  let targetUrl;
  try {
    targetUrl = new URL(uploadUrl);
  } catch {
    return send(res, 400, "Invalid upload URL");
  }

  // Content-Type phải khớp presign (client gửi lại qua header + ?ct=)
  let contentType = req.headers["content-type"] || "";
  try {
    const u = new URL(req.url || "/", "http://localhost");
    if (u.searchParams.get("ct")) contentType = u.searchParams.get("ct");
  } catch {
    /* ignore */
  }
  // Bỏ charset nếu browser tự thêm (làm lệch chữ ký)
  contentType = String(contentType || "application/octet-stream")
    .split(";")[0]
    .trim();

  // Chỉ Content-Type + Content-Length — không thêm header lạ (phá chữ ký R2)
  const headers = {
    "Content-Type": contentType,
    "Content-Length": String(body.length),
  };

  console.log(
    "[r2-put] PUT",
    targetUrl.hostname,
    targetUrl.pathname.slice(0, 60),
    "bytes=",
    body.length,
    "type=",
    contentType
  );

  const opts = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: 443,
    path: targetUrl.pathname + targetUrl.search,
    method: "PUT",
    headers,
    timeout: 120000,
  };

  const up = https.request(opts, (upRes) => {
    const chunks = [];
    upRes.on("data", (c) => chunks.push(c));
    upRes.on("end", () => {
      const buf = Buffer.concat(chunks);
      const text = buf.toString("utf8").slice(0, 200);
      console.log(
        "[r2-put] status",
        upRes.statusCode,
        "respBytes",
        buf.length,
        text
      );
      // R2/S3 thường 200/204 khi OK; 403 = chữ ký/Content-Type sai
      send(res, upRes.statusCode || 502, buf, {
        "Content-Type":
          upRes.headers["content-type"] || "text/plain; charset=utf-8",
      });
    });
  });

  up.on("timeout", () => {
    up.destroy();
    if (!res.headersSent) send(res, 504, "R2 upload timeout");
  });

  up.on("error", (err) => {
    console.error("[r2-put]", err.message);
    if (!res.headersSent) send(res, 502, "R2 upload failed: " + err.message);
  });

  up.write(body);
  up.end();
}

async function proxyRequest(req, res, proxy) {
  const search = req.url.includes("?") ? "?" + req.url.split("?").slice(1).join("?") : "";
  const targetUrl = new URL(proxy.rest + search, proxy.target);
  const isHttps = targetUrl.protocol === "https:";
  const lib = isHttps ? https : http;

  // CORS preflight (same-origin usually skips this)
  if (req.method === "OPTIONS") {
    return send(res, 204, "", {
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":
        req.headers["access-control-request-headers"] ||
        "content-type,authorization,x-api-key,x-app-author,x-app-name,x-app-client,x-app-api,x-app-env,x-locketdio-member,x-upload-url",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    });
  }

  let body = Buffer.alloc(0);
  try {
    body = await readBody(req);
  } catch (e) {
    console.error("[proxy] body read", e.message);
    return send(res, 400, "Bad request body");
  }

  // Clean hop-by-hop headers; KEEP content-length accurate for JSON POSTs
  const hopByHop = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "host",
    "accept-encoding",
  ]);

  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue;
    if (hopByHop.has(k.toLowerCase())) continue;
    headers[k] = v;
  }

  headers.host = targetUrl.host;
  headers.origin = ALLOWED_ORIGIN_SPOOF;
  headers.referer = ALLOWED_ORIGIN_SPOOF + "/";
  headers["content-length"] = String(body.length);

  // Prefer identity so we can stream response as-is
  headers["accept-encoding"] = "identity";

  const opts = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers,
    timeout: 90000,
  };

  const up = lib.request(opts, (upRes) => {
    const outHeaders = { ...upRes.headers };
    delete outHeaders["access-control-allow-origin"];
    delete outHeaders["access-control-allow-credentials"];
    delete outHeaders["access-control-allow-headers"];
    delete outHeaders["access-control-allow-methods"];
    delete outHeaders["content-encoding"]; // we asked identity

    if (outHeaders["set-cookie"]) {
      const cookies = Array.isArray(outHeaders["set-cookie"])
        ? outHeaders["set-cookie"]
        : [outHeaders["set-cookie"]];
      outHeaders["set-cookie"] = cookies.map((c) =>
        c
          .replace(/;\s*Domain=[^;]*/gi, "")
          .replace(/;\s*Secure/gi, "")
          .replace(/;\s*SameSite=[^;]*/gi, "; SameSite=Lax")
      );
    }

    res.writeHead(upRes.statusCode || 502, outHeaders);
    upRes.pipe(res);
  });

  up.on("timeout", () => {
    up.destroy();
    if (!res.headersSent) send(res, 504, "Upstream timeout");
  });

  up.on("error", (err) => {
    console.error("[proxy]", proxy.prefix, req.method, targetUrl.pathname, err.message);
    if (!res.headersSent) send(res, 502, "Bad gateway: " + err.message);
  });

  if (body.length) up.write(body);
  up.end();
}

const server = http.createServer((req, res) => {
  try {
    const urlPath = (req.url || "/").split("?")[0];

    // Shared Google Drive (admin) — OAuth + backup
    if (urlPath === "/api/drive-status") {
      return handleDriveStatus(req, res);
    }
    if (urlPath === "/api/drive-config") {
      return handleDriveConfigSave(req, res);
    }
    if (urlPath === "/api/drive-oauth-start") {
      return handleDriveOAuthStart(req, res);
    }
    if (urlPath === "/api/drive-oauth-callback") {
      return handleDriveOAuthCallback(req, res);
    }
    if (urlPath === "/api/drive-backup") {
      return handleDriveBackup(req, res);
    }

    // R2 presigned PUT proxy (avoids browser CORS on cloudflarestorage.com)
    if (urlPath === "/dio-r2-put") {
      return proxyR2Put(req, res);
    }

    const proxy = matchProxy(urlPath);
    if (proxy) {
      return proxyRequest(req, res, proxy);
    }
    return serveStatic(req, res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, "Internal error");
  }
});

server.listen(PORT, "0.0.0.0", async () => {
  console.log(`[huy-locket] listening on :${PORT}`);
  console.log(`[huy-locket] static: ${PUBLIC_DIR}`);
  console.log(`[huy-locket] proxies: ${PROXIES.map((p) => p.prefix).join(", ")}, /dio-r2-put`);
  await warmDriveConfig();
  const folder = getDriveFolderId();
  const mode = driveAuthMode();
  const ready = isDriveReady();
  console.log(
    `[locket-dio] gdrive: ${ready ? "ON (" + mode + ")" : "OFF"} neon=${neonReady} folder=${folder ? "yes" : "no"}`
  );
});
