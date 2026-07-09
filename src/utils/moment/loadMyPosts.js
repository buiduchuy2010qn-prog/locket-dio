/**
 * Tải toàn bộ bài của acc đang login (cache + API) để hiện lịch theo ngày.
 */
import { getMomentsByUser, getAllMoments, bulkAddMoments } from "@/cache/momentDB";
import { getPostedMoments } from "@/process/uploadQueue";
import { GetAllMoments } from "@/services";
import { isMyMoment } from "@/utils/auth/getMyLocalId";

/** Chuẩn hoá date về ms timestamp (số) để calendar parse ổn định */
export function normalizePostDate(post) {
  if (!post) return null;

  // Ưu tiên createTime (giây) từ API Locket
  if (post.createTime != null && Number(post.createTime) > 0) {
    const n = Number(post.createTime);
    return n < 1e12 ? n * 1000 : n;
  }

  const d = post.date;
  if (d == null) return null;
  if (d instanceof Date && !isNaN(d)) return d.getTime();
  if (typeof d === "number" && !isNaN(d)) {
    return d < 1e12 ? d * 1000 : d;
  }
  if (typeof d === "object" && d._seconds) {
    return Number(d._seconds) * 1000;
  }
  if (typeof d === "string") {
    const parsed = Date.parse(d);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

function mapForCalendar(post) {
  const ms = normalizePostDate(post);
  if (!ms) return null;

  return {
    ...post,
    id: post.id || post.canonical_uid || post.postId || `p-${ms}`,
    date: ms,
    thumbnail_url:
      post.thumbnail_url ||
      post.thumbnailUrl ||
      post.image_url ||
      post.imageUrl ||
      null,
    image_url: post.image_url || post.imageUrl || post.thumbnail_url || null,
    video_url: post.video_url || post.videoUrl || null,
  };
}

/**
 * @param {string} myLocalId
 * @returns {Promise<Array>} posts sorted mới → cũ
 */
export async function loadAllMyPosts(myLocalId) {
  if (!myLocalId) return [];

  const byId = new Map();

  const addList = (list) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      if (!raw) continue;
      // Chỉ bài của mình
      if (!isMyMoment(raw, myLocalId) && raw.user && raw.user !== myLocalId) {
        // postedMoments local có thể không có field user — vẫn lấy
        if (raw.user || raw.userUid || raw.owner) continue;
      }
      const mapped = mapForCalendar(raw);
      if (!mapped) continue;
      const key = mapped.id;
      const prev = byId.get(key);
      if (!prev || (mapped.date || 0) >= (prev.date || 0)) {
        byId.set(key, mapped);
      }
    }
  };

  // 1) Cache IndexedDB theo user
  try {
    const cached = await getMomentsByUser(myLocalId);
    addList(cached);
  } catch (e) {
    console.warn("[myPosts] cache user failed", e);
  }

  // 2) Toàn bộ cache (đề phòng field user khác)
  try {
    const all = await getAllMoments();
    addList(all.filter((m) => isMyMoment(m, myLocalId)));
  } catch {
    /* ignore */
  }

  // 3) Bài vừa đăng (queue local)
  try {
    const posted = await getPostedMoments();
    addList(
      posted.map((p) => ({
        ...p,
        user: p.user || myLocalId,
        id: p.id || p.postId,
      }))
    );
  } catch {
    /* ignore */
  }

  // 4) API: lấy nhiều trang bài của mình
  try {
    let timestamp = null;
    for (let page = 0; page < 15; page++) {
      const batch = await GetAllMoments({
        friendId: myLocalId,
        timestamp,
        limit: 80,
      });
      if (!batch?.length) break;
      addList(batch);
      try {
        await bulkAddMoments(batch);
      } catch {
        /* ignore */
      }
      // next cursor: createTime nhỏ nhất
      const times = batch
        .map((m) => Number(m.createTime) || normalizePostDate(m) / 1000)
        .filter((t) => t > 0);
      if (!times.length) break;
      const oldest = Math.min(...times);
      if (timestamp != null && oldest >= timestamp) break;
      timestamp = oldest;
      if (batch.length < 40) break;
    }
  } catch (e) {
    console.warn("[myPosts] API fetch failed", e);
  }

  return Array.from(byId.values()).sort(
    (a, b) => (b.date || 0) - (a.date || 0)
  );
}
