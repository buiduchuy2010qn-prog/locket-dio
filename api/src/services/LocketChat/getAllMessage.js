const axios = require("axios");
const { LOGIN_HEADERS } = require("../../utils/constants");
const { normalizeMessage } = require("../../utils/normalize/normalizeMessage");

// 🎯 Hàm lấy message từ Firestore REST API và chuẩn hoá dữ liệu
exports.getAllMessages = async (idToken, userId, pageToken, limit = 20) => {
  const url = `https://firestore.googleapis.com/v1/projects/locket-4252a/databases/(default)/documents/users/${userId}/conversations`;

  const headers = {
    ...LOGIN_HEADERS,
    Authorization: `Bearer ${idToken}`,
    Accept: "application/json",
  };

  const params = {
    pageSize: limit,
    orderBy: "last_updated desc", // hoặc "updateTime desc"
  };

  if (pageToken) params.pageToken = pageToken;

  try {
    const response = await axios.get(url, { headers, params });

    const documents = response.data.documents || [];
    // Chuẩn hoá dữ liệu Firestore -> plain object
    const conversations = documents.map((doc) => normalizeMessage(doc));

    return {
      messages: conversations,
      nextPageToken: response.data.nextPageToken || null,
    };
  } catch (error) {
    console.error(
      "❌ Lỗi khi lấy mess:",
      error.response?.data || error.message
    );
    return {
      messages: [],
      nextPageToken: null,
    };
  }
};
