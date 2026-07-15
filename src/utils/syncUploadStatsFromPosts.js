/**
 * Đồng bộ thống kê tải lên từ các bài đã đăng lên Locket (moments của chính user).
 * Dùng cho thẻ Pricing "Thống kê tải lên".
 */
import { GetAllMoments } from "@/services/LocketDioServices/ActionMoments";
import { getMomentsByUser } from "@/cache/momentDB";
import { getToken } from "@/utils";

const AVG_IMAGE_MB = 1.2;
const AVG_VIDEO_MB = 4.5;
const MAX_PAGES = 40; // 40 * 80 ≈ 3200 posts
const PAGE_LIMIT = 80;

function isVideoMoment(m) {
  return Boolean(m?.videoUrl || m?.video_url);
}

function isImageMoment(m) {
  if (isVideoMoment(m)) return false;
  return Boolean(
    m?.thumbnailUrl ||
      m?.thumbnail_url ||
      m?.md5 ||
      m?.id ||
      m?.canonical_uid,
  );
}

/**
 * Estimate total MB for a set of moments (no network HEAD — fast & reliable).
 */
function estimateStats(moments = []) {
  let images = 0;
  let videos = 0;
  for (const m of moments) {
    if (isVideoMoment(m)) videos += 1;
    else if (isImageMoment(m)) images += 1;
  }
  const mb =
    Math.round((images * AVG_IMAGE_MB + videos * AVG_VIDEO_MB) * 10) / 10;
  return {
    image_uploaded: images,
    video_uploaded: videos,
    image_uploads: images,
    video_uploads: videos,
    total_uploads: images + videos,
    total_storage_used_mb: mb,
    total_storage_used_bytes: Math.round(mb * 1024 * 1024),
    error_count: 0,
    updated_at: new Date().toISOString(),
    source: "moments_sync",
  };
}

/**
 * Fetch all own moments via history API (friendId = self).
 */
async function fetchOwnMomentsFromApi(localId) {
  const byId = new Map();
  let timestamp = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    let batch = null;
    try {
      batch = await GetAllMoments({
        timestamp,
        friendId: localId,
        limit: PAGE_LIMIT,
      });
    } catch (e) {
      console.warn("[upload-stats] GetAllMoments page fail", e?.message);
      break;
    }

    // API may return array or { moments: [] } / { data: [] }
    const list = Array.isArray(batch)
      ? batch
      : Array.isArray(batch?.moments)
        ? batch.moments
        : Array.isArray(batch?.data)
          ? batch.data
          : Array.isArray(batch?.entries)
            ? batch.entries
            : [];

    if (!list.length) break;

    for (const m of list) {
      if (!m) continue;
      // Only count posts owned by self
      const owner = m.user || m.userId || m.owner_uid;
      if (owner && owner !== localId) continue;
      const id = m.id || m.canonical_uid || m.md5;
      if (id) byId.set(id, m);
      else byId.set(`${m.date || 0}-${byId.size}`, m);
    }

    // Next page cursor = oldest date in this batch (seconds or ms)
    const dates = list
      .map((m) => Number(m.date || m.createTime || 0))
      .filter((d) => d > 0);
    if (!dates.length) break;
    const oldest = Math.min(...dates);
    // Firestore uses seconds in start_at; support both
    const nextTs = oldest > 1e12 ? Math.floor(oldest / 1000) : oldest;
    if (timestamp != null && nextTs >= timestamp) break;
    timestamp = nextTs;

    if (list.length < PAGE_LIMIT) break;
  }

  return Array.from(byId.values());
}

/**
 * Main sync: API + IndexedDB cache → unified stats object.
 * @returns {Promise<object|null>}
 */
export async function syncUploadStatsFromPosts() {
  const { localId } = getToken() || {};
  if (!localId) return null;

  // 1) Cached moments (instant)
  let cached = [];
  try {
    cached = (await getMomentsByUser(localId)) || [];
  } catch {
    cached = [];
  }

  // 2) Live fetch own history
  let remote = [];
  try {
    remote = await fetchOwnMomentsFromApi(localId);
  } catch (e) {
    console.warn("[upload-stats] remote fetch failed", e?.message);
  }

  // Merge by id
  const byId = new Map();
  for (const m of [...cached, ...remote]) {
    if (!m) continue;
    const owner = m.user || m.userId || m.owner_uid;
    if (owner && owner !== localId) continue;
    const id = m.id || m.canonical_uid || m.md5;
    if (id) byId.set(id, m);
  }

  const moments = Array.from(byId.values());
  if (moments.length === 0 && cached.length === 0 && remote.length === 0) {
    // No posts found — return zeros but mark synced
    return {
      image_uploaded: 0,
      video_uploaded: 0,
      image_uploads: 0,
      video_uploads: 0,
      total_uploads: 0,
      total_storage_used_mb: 0,
      total_storage_used_bytes: 0,
      error_count: 0,
      updated_at: new Date().toISOString(),
      source: "moments_sync_empty",
    };
  }

  const stats = estimateStats(moments);

  // Persist client-side for next open
  try {
    localStorage.setItem(
      `upload_stats_${localId}`,
      JSON.stringify(stats),
    );
  } catch {
    /* ignore */
  }

  return stats;
}

/** Load last synced stats from localStorage (no network). */
export function loadCachedUploadStats() {
  try {
    const { localId } = getToken() || {};
    if (!localId) return null;
    const raw = localStorage.getItem(`upload_stats_${localId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
