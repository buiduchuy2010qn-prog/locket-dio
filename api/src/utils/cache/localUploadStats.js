/**
 * Local upload stats (when Supabase is not configured).
 * Persists per-user counters so Pricing "Thống kê tải lên" shows real data.
 */
const fs = require("fs");
const path = require("path");

const STATS_DIR = path.resolve(process.cwd(), "data", "upload-stats");
const STATS_FILE = path.join(STATS_DIR, "stats.json");

function ensureStore() {
  try {
    if (!fs.existsSync(STATS_DIR)) {
      fs.mkdirSync(STATS_DIR, { recursive: true });
    }
    if (!fs.existsSync(STATS_FILE)) {
      fs.writeFileSync(STATS_FILE, "{}", "utf8");
    }
  } catch (e) {
    console.warn("[localUploadStats] ensureStore:", e.message);
  }
}

function readAll() {
  ensureStore();
  try {
    const raw = fs.readFileSync(STATS_FILE, "utf8");
    return JSON.parse(raw || "{}") || {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  ensureStore();
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.warn("[localUploadStats] writeAll:", e.message);
  }
}

function emptyStats() {
  return {
    image_uploaded: 0,
    video_uploaded: 0,
    total_uploads: 0,
    total_storage_used_mb: 0,
    total_storage_used_bytes: 0,
    error_count: 0,
    updated_at: null,
  };
}

/**
 * Normalize any legacy / mixed shapes to UI field names.
 */
function normalize(raw = {}) {
  const base = emptyStats();
  const image =
    Number(raw.image_uploaded ?? raw.image_uploads ?? raw.images ?? 0) || 0;
  const video =
    Number(raw.video_uploaded ?? raw.video_uploads ?? raw.videos ?? 0) || 0;
  const bytes =
    Number(raw.total_storage_used_bytes ?? 0) ||
    Math.round(
      (Number(raw.total_storage_used_mb ?? raw.storage_used_mb ?? 0) || 0) *
        1024 *
        1024,
    );
  const errors = Number(raw.error_count ?? raw.errors ?? 0) || 0;
  const mb = Math.round((bytes / (1024 * 1024)) * 100) / 100;
  return {
    ...base,
    image_uploaded: image,
    video_uploaded: video,
    total_uploads: image + video,
    // aliases for older UI
    image_uploads: image,
    video_uploads: video,
    total_storage_used_bytes: bytes,
    total_storage_used_mb: mb,
    error_count: errors,
    updated_at: raw.updated_at || null,
  };
}

function getUserStats(uid) {
  if (!uid) return emptyStats();
  const all = readAll();
  return normalize(all[String(uid)] || {});
}

/** Overwrite stats (e.g. after client sync from published posts). */
function setUserStats(uid, stats = {}) {
  if (!uid) return emptyStats();
  const all = readAll();
  const next = normalize({
    ...emptyStats(),
    ...stats,
    updated_at: new Date().toISOString(),
  });
  all[String(uid)] = next;
  writeAll(all);
  return next;
}

/**
 * @param {{ uid: string, mediaType?: 'image'|'video'|null, sizeInBytes?: number, isError?: boolean }} opts
 */
function incrementUserStats({
  uid,
  mediaType = null,
  sizeInBytes = 0,
  isError = false,
}) {
  if (!uid) return emptyStats();
  const all = readAll();
  const key = String(uid);
  const cur = normalize(all[key] || {});

  if (isError) {
    cur.error_count += 1;
  } else {
    const size = Math.max(0, Number(sizeInBytes) || 0);
    if (mediaType === "image") {
      cur.image_uploaded += 1;
    } else if (mediaType === "video") {
      cur.video_uploaded += 1;
    } else {
      // unknown type — count as image
      cur.image_uploaded += 1;
    }
    cur.total_storage_used_bytes += size;
  }

  cur.total_uploads = cur.image_uploaded + cur.video_uploaded;
  cur.total_storage_used_mb =
    Math.round((cur.total_storage_used_bytes / (1024 * 1024)) * 100) / 100;
  cur.image_uploads = cur.image_uploaded;
  cur.video_uploads = cur.video_uploaded;
  cur.updated_at = new Date().toISOString();

  all[key] = cur;
  writeAll(all);
  return cur;
}

module.exports = {
  getUserStats,
  setUserStats,
  incrementUserStats,
  normalize,
  emptyStats,
};
