const axios = require("axios");
const { LOGIN_HEADERS } = require("../../../utils/constants");
const { normalizeMoment, normalizeReactions } = require("../../../utils/normalize");

// 🎯 Hàm lấy moments từ Firestore REST API và chuẩn hoá dữ liệu
exports.getLocketMoments = async (
  idToken,
  userId,
  pageToken,
  userUid,
  limit = 20
) => {
  const url = `https://firestore.googleapis.com/v1/projects/locket-4252a/databases/locket/documents/history/${userId}/entries`;

  const headers = {
    Authorization: `Bearer ${idToken}`,
    Accept: "application/json",
  };

  const params = {
    orderBy: "date desc",
    pageSize: pageToken ? 100 : limit,
  };
  if (pageToken) params.pageToken = pageToken;

  try {
    const response = await axios.get(url, { headers, params });
    const documents = response.data.documents || [];

    // ✅ Chuẩn hoá ngay tại server
    const moments = documents
      .map((doc) => {
        const moment = normalizeMoment(doc);
        if (userUid && moment?.user !== userUid) return null;
        return moment;
      })
      .filter(Boolean);

    return {
      moments,
      nextPageToken: response.data.nextPageToken || null,
    };
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy moments:",
      error.response?.data || error.message
    );
    return {
      moments: [],
      nextPageToken: null,
    };
  }
};

exports.ReactPostLocketMoments = async (idToken, uid, reactionInfo) => {
  const headers = {
    ...LOGIN_HEADERS,
    Authorization: `Bearer ${idToken}`,
    Accept: "application/json",
  };

  try {
    const body = {
      data: {
        intensity: reactionInfo.intensity || 0,
        moment_uid: reactionInfo.moment_id,
        reaction: reactionInfo.emoji || "💛",
        owner_uid: uid,
      },
    };

    const response = await axios.post(
      "https://api.locketcamera.com/reactToMoment",
      body,
      { headers }
    );

    return response.data;
  } catch (error) {
    console.error(
      "❌ Lỗi khi gửi reaction:",
      error.response?.data || error.message
    );
    return error.response?.data || error.message; // ← Sửa dấu ',' thành ';'
  }
};

exports.SendChatLocketMoments = async (idToken, uid, MessageInfo) => {
  const headers = {
    ...LOGIN_HEADERS,
    Authorization: `Bearer ${idToken}`,
    Accept: "application/json",
  };

  try {
    const body = {
      data: {
        msg: MessageInfo.message || " ", // Tin nhắn
        analytics: {
          amplitude: {
            device_id:
              process.env.LOCKET_ANALYTICS_DEVICE_ID ||
              `web-${uid || "anon"}`.slice(0, 36),
            session_id: -1,
          },
          google_analytics: {
            app_instance_id:
              process.env.LOCKET_GA_APP_INSTANCE_ID ||
              String(uid || "anon").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32) ||
              "web",
          },
          android_version: "1.196.0",
          android_build: "406",
          platform: "android",
        },
        client_token:
          process.env.LOCKET_CLIENT_TOKEN ||
          process.env.LOCKET_CHAT_CLIENT_TOKEN ||
          "",
        moment_uid: MessageInfo?.moment_id || null, //Moment id nếu có ko thì null
        receiver_uid: MessageInfo.receiver_uid, //Người nhận
      },
    };
    const response = await axios.post(
      "https://api.locketcamera.com/sendChatMessageV2",
      body,
      { headers }
    );

    return response.data;
  } catch (error) {
    console.error(
      "❌ Lỗi khi gửi tin nhắn:",
      error.response?.data || error.message
    );
    return error.response?.data || error.message; // ← Sửa dấu ',' thành ';'
  }
};

exports.GetLastestLocketMoments = async (idToken, uid) => {
  const headers = {
    ...LOGIN_HEADERS,
    Authorization: `Bearer ${idToken}`,
    Accept: "application/json",
  };

  try {
    const body = {
      data: {
        excluded_users: [],
        fetch_streak: true,
        should_count_missed_moments: true,
      },
    };

    const response = await axios.post(
      "https://api.locketcamera.com/getLatestMomentV2",
      body,
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy moments mới nhất:",
      error.response?.data || error.message
    );
    return error.response?.data || error.message; // ← Sửa dấu ',' thành ';'
  }
};

exports.getInfoLocketMoments = async (idToken, idMoment) => {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/locket-4252a/databases/(default)/documents/moments/${idMoment}`;
  
  const headers = {
    Authorization: `Bearer ${idToken}`,
    Accept: "application/json",
    ...LOGIN_HEADERS,
  };

  // Helper: fetch tất cả page nếu có nextPageToken
  const fetchAllDocs = async (url) => {
    let allDocs = [];
    let nextPageToken = null;

    do {
      const finalUrl = nextPageToken
        ? `${url}?pageToken=${nextPageToken}`
        : url;

      try {
        const res = await axios.get(finalUrl, { headers });
        const docs = res.data.documents || [];
        allDocs = allDocs.concat(docs);
        nextPageToken = res.data.nextPageToken || null;
      } catch (err) {
        console.error(
          "❌ Lỗi khi fetch:",
          finalUrl,
          err.response?.data || err.message
        );
        break;
      }
    } while (nextPageToken);

    return allDocs;
  };

  const urlReactions = `${baseUrl}/reactions`;

  // 🚫 Tạm thời không dùng views
  // const urlViews = `${baseUrl}/moment_views`;

  try {
    const reactionsDocs = await fetchAllDocs(urlReactions);

    // Nếu sau này cần bật lại views:
    // const viewsDocs = await fetchAllDocs(urlViews);

    return {
      reactions: normalizeReactions(reactionsDocs),

      // views: normalizeViews(viewsDocs),
      views: [], // tạm thời trả rỗng để không vỡ cấu trúc
    };
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy info moment:",
      error.response?.data || error.message
    );

    return {
      reactions: [],
      views: [],
    };
  }
};


