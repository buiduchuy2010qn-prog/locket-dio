const { instanceLocketV2 } = require("../../libs");
const { createAnalytics } = require("../LocketAnalytics");

const axios = require("axios");
const constants = require("../../utils/constants");

const getAllFriends = async (idToken, localId) => {
  //    GET_ACCOUNT_INFO_URL_V2: `https://firestore.googleapis.com/v1/projects/locket-4252a/databases/(default)/documents/users/`,
  const baseUrl = `${constants.GET_ACCOUNT_INFO_URL_V2}${localId}/friends`;
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
        uid: doc.fields?.user?.stringValue,
        date: doc.createTime,
      }));

      allFriends.push(...parsedFriends);
      pageToken = response.data.nextPageToken || null;
    } while (pageToken);

    return allFriends;
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy danh sách bạn bè:",
      error.response?.data || error.message,
    );
    return []; // Trả về mảng rỗng nếu lỗi
  }
};

const removeFriend = async (idToken, uid) => {
  const url = "https://api.locketcamera.com/removeFriend";

  try {
    const response = await axios.post(
      url,
      {
        data: { user_uid: uid },
      },
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...constants.AUTH_HEADER,
        },
      },
    );

    const result = response.data?.result;
    console.log(result);

    // ✅ Trường hợp xoá thành công
    if (result?.data?.user_uid === uid) {
      console.log(`✅ Xoá bạn bè thành công: ${uid}`);
      return {
        success: true,
        uid: result?.data.user_uid,
        message: "Xoá bạn bè thành công",
      };
    }
    return result?.data;
  } catch (error) {
    // ❌ Lỗi thực sự từ mạng / server
    const errorMsg = error?.response?.data || error.message;
    console.error(`❌ Lỗi API khi xoá bạn: ${uid} -`, errorMsg);
    return {
      success: false,
      uid,
      message: errorMsg,
    };
  }
};

const AcceptToFriend = async (idToken, uid) => {
  const url = "https://api.locketcamera.com/acceptFriendRequest";

  try {
    const response = await axios.post(
      url,
      {
        data: { user_uid: uid },
      },
      {
        headers: {
          Authorization: `Bearer ${idToken}`,
          ...constants.AUTH_HEADER,
        },
      },
    );

    const result = response.data?.result;

    // ✅ Kiểm tra kết quả trả về
    if (result?.data?.user_uid === uid) {
      console.log(`✅ Chấp nhận lời mời kết bạn thành công: ${uid}`);
      return {
        success: true,
        uid,
        message: "Chấp nhận lời mời kết bạn thành công",
      };
    }
    return result?.data;
  } catch (error) {
    const errorMsg = error?.response?.data || error.message;
    console.error(`❌ Lỗi API khi chấp nhận lời mời từ ${uid}:`, errorMsg);
    return {
      success: false,
      uid,
      message: errorMsg,
    };
  }
};

// Hàm tìm bạn qua username
const FindFriendByUserName = async (idToken, username) => {
  try {
    const body = {
      data: {
        username: username,
        analytics: {
          ios_version: "2.8.0.1",
          experiments: {
            flag_4: {
              "@type": "type.googleapis.com/google.protobuf.Int64Value",
              value: "43",
            },
            flag_9: {
              value: "11",
              "@type": "type.googleapis.com/google.protobuf.Int64Value",
            },
            flag_22: {
              "@type": "type.googleapis.com/google.protobuf.Int64Value",
              value: "1203",
            },
            flag_7: {
              value: "802",
              "@type": "type.googleapis.com/google.protobuf.Int64Value",
            },
            flag_10: {
              value: "505",
              "@type": "type.googleapis.com/google.protobuf.Int64Value",
            },
            flag_3: {
              value: "600",
              "@type": "type.googleapis.com/google.protobuf.Int64Value",
            },
            flag_18: {
              "@type": "type.googleapis.com/google.protobuf.Int64Value",
              value: "1203",
            },
            flag_6: {
              value: "2000",
              "@type": "type.googleapis.com/google.protobuf.Int64Value",
            },
            flag_15: {
              value: "501",
              "@type": "type.googleapis.com/google.protobuf.Int64Value",
            },
            flag_14: {
              value: "502",
              "@type": "type.googleapis.com/google.protobuf.Int64Value",
            },
          },
          amplitude: {
            device_id: "562882AF-2F2D-47B0-8B64-B96E491F085B",
            session_id: {
              value: "1769358896753",
              "@type": "type.googleapis.com/google.protobuf.Int64Value",
            },
          },
          google_analytics: {
            app_instance_id: "69C274F34E7145C7B8D73236ECFB4E28",
          },
          platform: "ios",
        },
      },
    };
    const response = await instanceLocketV2.post("getUserByUsername", body, {
      meta: { idToken },
    });

    return response.data?.result;
  } catch (error) {
    console.error("❌ Lỗi khi tìm bạn:", error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  getAllFriends,
  removeFriend,
  AcceptToFriend,
  FindFriendByUserName,
};
