const axios = require("axios");
const crypto = require("crypto");
const constants = require("../../utils/constants");
const { instanceLocketV2 } = require("../../libs");
const { createAnalytics } = require("../LocketAnalytics");

const getAllFriendRequests = async (
  idToken,
  localId,
  pageToken = null,
  limit = 10,
) => {
  const baseUrl = `${constants.GET_ACCOUNT_INFO_URL_V2}${localId}/incoming_friend_requests`;
  const headers = {
    Authorization: `Bearer ${idToken}`,
    Accept: "application/json",
  };

  try {
    const url = pageToken
      ? `${baseUrl}?pageSize=${limit}&pageToken=${pageToken}`
      : `${baseUrl}?pageSize=${limit}`;

    const response = await axios.get(url, { headers });
    const documents = response.data.documents || [];
    const nextPageToken = response.data.nextPageToken || null;

    const parsedRequests = documents.map((doc) => ({
      uid: doc.fields?.requesting_user?.stringValue || null,
      to: doc.fields?.requested_user?.stringValue || null,
      date: doc.fields?.created_at?.timestampValue || doc.createTime,
      shareEligible: doc.fields?.share_history_eligible?.booleanValue ?? false,
      docId: doc.name.split("/").pop(),
    }));

    return {
      data: parsedRequests,
      nextPageToken,
    };
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy danh sách lời mời kết bạn:",
      error.response?.data || error.message,
    );
    return {
      data: [],
      nextPageToken: null,
    };
  }
};

const getAllFriendRequestsV2 = async (
  idToken,
  localId,
  // pageToken = null,
  limit = 10,
) => {
  const baseUrl = `${constants.GET_ACCOUNT_INFO_URL_V2}${localId}/incoming_friend_requests`;
  const headers = {
    Authorization: `Bearer ${idToken}`,
    Accept: "application/json",
  };

  let pageToken = null;
  const allFriends = [];
  try {
    do {
      const url = pageToken
        ? `${baseUrl}?pageSize=100&pageToken=${pageToken}`
        : `${baseUrl}?pageSize=100`;

      const response = await axios.get(url, { headers });
      const documents = response.data.documents || [];

      const parsedFriends = documents.map((doc) => ({
        uid: doc.fields?.requesting_user?.stringValue,
        date: doc.createTime,
      }));

      allFriends.push(...parsedFriends);
      pageToken = response.data.nextPageToken || null;
    } while (pageToken);

    return { data: allFriends };
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy danh sách lời mời kết bạn:",
      error.response?.data || error.message,
    );
    return {
      data: [],
      nextPageToken: null,
    };
  }
};

const getOutgoingFriendRequests = async (
  idToken,
  localId,
  pageToken = null,
  limit = 10,
) => {
  const baseUrl = `${constants.GET_ACCOUNT_INFO_URL_V2}${localId}/outgoing_friend_requests`;
  const headers = {
    Authorization: `Bearer ${idToken}`,
    Accept: "application/json",
  };

  try {
    const url = pageToken
      ? `${baseUrl}?pageSize=${limit}&pageToken=${pageToken}`
      : `${baseUrl}?pageSize=${limit}`;

    const response = await axios.get(url, { headers });
    const documents = response.data.documents || [];
    const nextPageToken = response.data.nextPageToken || null;

    const parsedRequests = documents.map((doc) => ({
      uid: doc.fields?.requesting_user?.stringValue || null,
      to: doc.fields?.requested_user?.stringValue || null,
      date: doc.fields?.created_at?.timestampValue || doc.createTime,
      shareEligible: doc.fields?.share_history_eligible?.booleanValue ?? false,
      docId: doc.name.split("/").pop(),
    }));

    return {
      data: parsedRequests,
      nextPageToken,
    };
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy danh sách lời mời kết bạn:",
      error.response?.data || error.message,
    );
    return {
      data: [],
      nextPageToken: null,
    };
  }
};

//
const rejectFriendRequest = async (idToken, uids) => {
  const url = "https://api.locketcamera.com/deleteFriendRequest";
  const results = [];

  const batchSize = 50;
  const total = uids.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = uids.slice(i, i + batchSize);

    console.log(
      `🚀 Đang xử lý batch ${i / batchSize + 1} (${i + 1} → ${
        i + batch.length
      })`,
    );

    const batchResults = await Promise.allSettled(
      batch.map(async (uid, index) => {
        const body = {
          data: {
            user_uid: uid,
            direction: "incoming",
          },
        };

        try {
          const response = await axios.post(url, body, {
            headers: {
              Authorization: `Bearer ${idToken}`,
              ...constants.AUTH_HEADER,
            },
          });

          if (response.data?.result?.data === null) {
            console.log(
              `✅ [${i + index + 1}/${total}] Xoá thành công: ${uid}`,
            );
            return { success: true, uid };
          } else {
            console.error(
              `❌ [${i + index + 1}/${total}] Xoá thất bại: ${uid} -`,
              response.data?.result?.message,
            );
            return {
              success: false,
              uid,
              message: response.data?.result?.message || "Unknown error",
            };
          }
        } catch (error) {
          console.error(
            `❌ [${i + index + 1}/${total}] Lỗi API: ${uid} -`,
            error?.response?.data || error.message,
          );
          return {
            success: false,
            uid,
            message: error?.response?.data || error.message,
          };
        }
      }),
    );

    results.push(
      ...batchResults.map(
        (r) =>
          r.value || { success: false, uid: null, message: "Unknown error" },
      ),
    );
  }

  return results;
};

const rejectOutgoingFriendRequest = async (idToken, uid) => {
  const url = "https://api.locketcamera.com/deleteFriendRequest";

  const body = {
    data: {
      user_uid: uid,
      direction: "outgoing",
    },
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...constants.AUTH_HEADER,
      },
    });

    if (response.data?.result?.data === null) {
      console.log(`✅ Xoá thành công: ${uid}`);
      return { success: true, uid };
    } else {
      console.error(
        `❌ Xoá thất bại: ${uid} -`,
        response.data?.result?.message,
      );
      return {
        success: false,
        uid,
        message: response.data?.result?.message || "Unknown error",
      };
    }
  } catch (error) {
    console.error(
      `❌ Lỗi API khi xoá: ${uid} -`,
      error?.response?.data || error.message,
    );
    return {
      success: false,
      uid,
      message: error?.response?.data || error.message,
    };
  }
};

/**
 * Gửi lời mời kết bạn đến người dùng có UID là `friend_uid`
 * @param {string} idToken - Firebase ID token để xác thực
 * @param {string} friend_uid - UID của người muốn gửi lời mời kết bạn
 * @returns {object} Kết quả thành công hoặc lỗi
 */
const SendToFriendRequest = async ({ idToken, friendUid, appcheckToken }) => {
  const body = {
    data: {
      user_uid: friendUid,
      source: "signUp",
      platform: "iOS",
      messenger: "Messages",
      invite_variant: {
        value: "1002",
        "@type": "type.googleapis.com/google.protobuf.Int64Value",
      },
      share_history_eligible: true,
      rollcall: false,
      prompted_reengagement: false,
      create_ofr_for_temp_users: false,
      get_reengagement_status: false,
    },
  };

  try {
    const response = await instanceLocketV2.post("sendFriendRequest", body, {
      meta: { idToken: idToken, appCheckToken: appcheckToken },
    });

    console.log(response.data);

    return response.data;
  } catch (error) {
    console.error(
      `❌ Lỗi khi gọi API gửi lời mời kết bạn đến ${friendUid}:`,
      error?.response?.data || error.message,
    );
    return {
      success: false,
      uid: friendUid,
      message: error?.response?.data || error.message,
    };
  }
};

/**
 * Chấp nhận lời mời kết bạn từ người có UID là `friend_uid`
 * @param {string} idToken - Firebase ID token để xác thực
 * @param {string} friend_uid - UID của người đã gửi lời mời kết bạn
 * @returns {object} Kết quả thành công hoặc lỗi
 */
const AcceptToFriendRequest = async (idToken, friend_uid) => {
  const url = "https://api.locketcamera.com/acceptFriendRequest";
  const body = {
    data: {
      user_uid: friend_uid,
    },
  };

  try {
    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...constants.AUTH_HEADER,
      },
    });

    if (response.data?.result?.data !== null) {
      console.log(`✅ Đã chấp nhận lời mời kết bạn từ: ${friend_uid}`);
      return { success: true, uid: friend_uid };
    } else {
      console.error(
        `❌ Không thể chấp nhận lời mời kết bạn từ ${friend_uid}:`,
        response.data?.result?.message,
      );
      return {
        success: false,
        uid: friend_uid,
        message: response.data?.result?.message || "Không rõ lỗi",
      };
    }
  } catch (error) {
    console.error(
      `❌ Lỗi khi gọi API chấp nhận lời mời kết bạn từ ${friend_uid}:`,
      error?.response?.data || error.message,
    );
    return {
      success: false,
      uid: friend_uid,
      message: error?.response?.data || error.message,
    };
  }
};

const SendAddCelebrity = async (idToken, friend_uid, token) => {
  const body = {
    data: {
      celebrity_uid: friend_uid,
      intent: "add-friend",
      analytics: createAnalytics(),
    },
  };

  try {
    const response = await instanceLocketV2.post("sendFollowRequest", body, {
      meta: { idToken, appCheckToken: token },
    });
    console.log(response.data);

    if (response.data?.result?.data !== null) {
      console.log(`✅ Đã chấp nhận lời mời kết bạn từ: ${friend_uid}`);
      return { success: true, uid: friend_uid };
    } else {
      console.error(
        `❌ Không thể chấp nhận lời mời kết bạn từ ${friend_uid}:`,
        response.data?.result?.message,
      );
      return {
        success: false,
        uid: friend_uid,
        message: response.data?.result?.message || "Không rõ lỗi",
      };
    }
  } catch (error) {
    console.error(
      `❌ Lỗi khi gọi API chấp nhận lời mời kết bạn từ ${friend_uid}:`,
      error?.response?.data || error.message,
    );
    return {
      success: false,
      uid: friend_uid,
      message: error?.response?.data || error.message,
    };
  }
};

module.exports = {
  getAllFriendRequests,
  getAllFriendRequestsV2,
  getOutgoingFriendRequests,
  rejectOutgoingFriendRequest,
  rejectFriendRequest,
  SendToFriendRequest,
  AcceptToFriendRequest,
  SendAddCelebrity,
};
