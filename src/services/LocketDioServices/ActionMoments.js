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

export const GetInfoMoment = async (idMoment) => {
  try {
    const res = await api.post("/locket/getInfoMomentV2", {
      pageToken: null,
      idMoment,
      limit: null,
    });
    const moments = res.data.data;
    return moments;
  } catch (err) {
    console.warn("❌ React Failed", err);
  }
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

    const res = await instanceLocketV2.post("getMomentViews", body); // 👈 thêm body
    const moments = res.data.result;
    return moments;
  } catch (err) {
    console.warn("❌ markMomentAsViewed Failed", err);
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
