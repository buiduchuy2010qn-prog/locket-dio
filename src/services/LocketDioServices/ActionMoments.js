import { getMomentById } from "@/cache/momentDB";
import { API_ENDPOINTS } from "@/config/apiConfig";
import api from "@/lib/axios";
import { instanceLocketV2 } from "@/lib/axios.locket";
import { getToken } from "@/utils";
import { generateUUIDv4Upper } from "@/utils/generate/uuid";


/** Normalize moment fields for cache/UI (createTime, thumbnail, user) */
const normalizeMoment = (m) => {
  if (!m || typeof m !== "object") return m;
  const createTime =
    m.createTime ||
    m.date?._seconds ||
    (typeof m.date === "number" ? m.date : null) ||
    (m.date ? Math.floor(new Date(m.date).getTime() / 1000) : 0) ||
    0;
  // user = owner localId — dùng để filter "Bạn"
  const owner =
    m.user || m.userUid || m.owner || m.owner_uid || m.uid || null;
  return {
    ...m,
    createTime: Number(createTime) || 0,
    user: owner,
    userUid: m.userUid || owner,
    thumbnail_url:
      m.thumbnail_url || m.thumbnailUrl || m.image_url || m.imageUrl,
    image_url: m.image_url || m.imageUrl || m.thumbnail_url,
    video_url: m.video_url || m.videoUrl || null,
  };
};

export const GetAllMoments = async ({
  timestamp = null,
  friendId = null,
  limit = 60,
}) => {
  try {
    // Official: POST /locket/getMomentV2 on api.locket-dio.com (via /dio-api)
    const res = await api.post(API_ENDPOINTS.getMoments || "/locket/getMomentV2", {
      timestamp,
      friendId,
      limit,
    });
    const raw = res.data?.data ?? res.data;
    const list = Array.isArray(raw) ? raw : raw?.moments || [];
    return list.map(normalizeMoment);
  } catch (err) {
    console.warn("Failed GetAllMoments:", err?.response?.data || err.message);
    return [];
  }
};

export const SendReactMoment = async (emoji, selectedMomentId, power) => {
  try {
    const { localId } = getToken();

    const body = {
      data: {
        intensity: power || 0,
        moment_uid: selectedMomentId,
        reaction: emoji || "💛",
        owner_uid: localId,
      },
    };
    const response = await instanceLocketV2.post("reactToMoment", body);

    return response.data;
  } catch (err) {
    console.warn("❌ React Failed", err);
  }
};

/** Chuẩn hoá payload views/reactions từ Dio hoặc Locket API */
const normalizeMomentActivity = (raw) => {
  if (!raw || typeof raw !== "object") {
    return { views: [], reactions: [], pageToken: null };
  }
  // Một số endpoint bọc trong data/result
  const payload = raw.data ?? raw.result ?? raw;

  let views =
    payload.views ??
    payload.viewers ??
    payload.view_list ??
    payload.users_who_viewed ??
    payload.seen_by ??
    [];
  let reactions =
    payload.reactions ??
    payload.reacts ??
    payload.reaction_list ??
    payload.users_who_reacted ??
    [];

  // getMomentViews đôi khi trả mảng viewer thuần
  if (Array.isArray(payload) && !payload.views) {
    views = payload;
  }
  if (!Array.isArray(views)) views = [];
  if (!Array.isArray(reactions)) reactions = [];

  const mapView = (v) => {
    if (v == null) return null;
    if (typeof v === "string" || typeof v === "number") {
      return { user: String(v), viewedAt: null };
    }
    if (typeof v !== "object") return null;
    const user =
      v.user ||
      v.uid ||
      v.user_uid ||
      v.userUid ||
      v.viewer_uid ||
      v.viewerUid ||
      v.id ||
      v.localId ||
      "";
    return {
      user: String(user || ""),
      viewedAt:
        v.viewedAt ||
        v.viewed_at ||
        v.seen_at ||
        v.createdAt ||
        v.created_at ||
        v.timestamp ||
        v.time ||
        null,
    };
  };

  const mapReaction = (r) => {
    if (!r || typeof r !== "object") return null;
    const user =
      r.user || r.uid || r.user_uid || r.userUid || r.id || r.localId || "";
    if (!user) return null;
    return {
      user: String(user),
      emoji: r.emoji || r.reaction || r.react || "💛",
      intensity: r.intensity ?? r.power ?? r.strength ?? 0,
      createdAt:
        r.createdAt || r.created_at || r.timestamp || r.time || null,
    };
  };

  return {
    views: views.map(mapView).filter((v) => v?.user),
    reactions: reactions.map(mapReaction).filter(Boolean),
    pageToken:
      payload.pageToken ||
      payload.nextPageToken ||
      payload.next_page_token ||
      null,
  };
};

const mergeActivity = (a, b) => {
  const viewMap = new Map();
  const reactMap = new Map();
  for (const src of [a, b]) {
    for (const v of src?.views || []) {
      if (!v?.user) continue;
      const prev = viewMap.get(v.user);
      if (!prev || (v.viewedAt && !prev.viewedAt)) viewMap.set(v.user, v);
    }
    for (const r of src?.reactions || []) {
      if (!r?.user) continue;
      reactMap.set(r.user, r);
    }
  }
  return {
    views: Array.from(viewMap.values()),
    reactions: Array.from(reactMap.values()),
  };
};

/** Gọi Dio getInfoMomentV2 — lặp pageToken nếu có để lấy full */
const fetchDioInfoMomentAll = async (idMoment) => {
  let pageToken = null;
  let acc = { views: [], reactions: [] };
  for (let i = 0; i < 10; i++) {
    const res = await api.post("/locket/getInfoMomentV2", {
      pageToken,
      idMoment,
      // limit lớn để lấy đủ người xem / reaction
      limit: 200,
    });
    const raw = res?.data?.data ?? res?.data?.result ?? res?.data;
    const page = normalizeMomentActivity(raw);
    acc = mergeActivity(acc, page);
    if (!page.pageToken || page.pageToken === pageToken) break;
    pageToken = page.pageToken;
  }
  return acc;
};

export const GetInfoMoment = async (idMoment) => {
  if (!idMoment) return { views: [], reactions: [] };

  // Gọi song song Dio + Locket native, gộp full (không bỏ sót nguồn nào)
  const [dioRes, locketRes] = await Promise.allSettled([
    fetchDioInfoMomentAll(idMoment),
    getMomentViews(idMoment).then((viewsRaw) =>
      normalizeMomentActivity(
        viewsRaw && typeof viewsRaw === "object"
          ? viewsRaw
          : { views: Array.isArray(viewsRaw) ? viewsRaw : [] }
      )
    ),
  ]);

  let merged = { views: [], reactions: [] };
  if (dioRes.status === "fulfilled") {
    merged = mergeActivity(merged, dioRes.value);
  } else {
    console.warn("❌ GetInfoMoment Dio failed:", dioRes.reason?.message || dioRes.reason);
  }
  if (locketRes.status === "fulfilled") {
    merged = mergeActivity(merged, locketRes.value);
  } else {
    console.warn(
      "❌ getMomentViews failed:",
      locketRes.reason?.message || locketRes.reason
    );
  }

  return merged;
};

export const GetLastestMoment = async () => {
  try {
    const body = {
      data: {
        excluded_users: [],
        fetch_streak: true,
        should_count_missed_moments: true,
      },
    };

    const res = await instanceLocketV2.post("getLatestMomentV2", body); // 👈 thêm body
    const moments = res.data.result;
    return moments;
  } catch (err) {
    console.warn("❌ React Failed", err);
  }
};

export const getMomentViews = async (momentId) => {
  try {
    const body = {
      data: {
        moment_uid: momentId,
      },
    };

    const res = await instanceLocketV2.post("getMomentViews", body);
    // result có thể là mảng viewers hoặc { views, reactions }
    return res?.data?.result ?? res?.data?.data ?? res?.data ?? [];
  } catch (err) {
    console.warn("❌ getMomentViews Failed", err?.response?.data || err?.message);
    return [];
  }
};

export const SendMessageMoment = async (message, selectedMomentId, uid) => {
  try {
    const body = {
      data: {
        msg: message || " ", // Nội dung tin nhắn
        analytics: {
          amplitude: {
            device_id: generateUUIDv4Upper(),
            session_id: -1,
          },
          google_analytics: {
            app_instance_id: "e88d4daed0ded172248753851bf67772",
          },
          android_version: "1.196.0",
          android_build: "406",
          platform: "android",
        },
        client_token: generateUUIDv4Upper(),
        moment_uid: selectedMomentId || null,
        receiver_uid: uid,
      },
    };

    const response = await instanceLocketV2.post("sendChatMessageV2", body);

    return response.data;
  } catch (err) {
    console.error("sendMessage error:", err);
    throw err;
  }
};

export const DeleteMoment = async (selectedMomentId) => {
  try {
    const infoMoment = await getMomentById(selectedMomentId);
    const { localId } = getToken();

    if (!infoMoment) {
      console.warn("❌ Moment not found for deletion");
      return null;
    }

    //Xác định có xoá toàn cục không?
    const deleteGlobally = infoMoment.user === localId;

    const body = {
      data: {
        moment_uid: selectedMomentId,
        owner_uid: infoMoment.user,
        delete_globally: deleteGlobally, // true nếu là chủ sở hữu
      },
    };

    const res = await instanceLocketV2.post("deleteMomentV2", body);

    const deletedIds = res?.data?.result?.data;
    const deletedId = Array.isArray(deletedIds) ? deletedIds[0] : null;
    return deletedId; // 👉 trả về ID đã xoá
  } catch (err) {
    console.warn("❌ Failed", err);
    return null;
  }
};

export const markAsViewedMoment = async (selectedMomentId) => {
  try {
    const body = {
      data: {
        moment_uid: selectedMomentId,
        notify: false,
      },
    };
    const res = await instanceLocketV2.post("markMomentAsViewed", body);
    const moments = res.data;
    return moments;
  } catch (err) {
    console.warn("❌ Failed", err);
  }
};
