const { logInfo } = require("../../../utils/logEventUtils");
const {
  listConversations,
  conversationWithUserV2,
  listMoments,
  listConversationsV2,
} = require("../services");

/**
 * Lấy tin nhắn 1 người dùng (dùng cho REST + Socket)
 */
async function getMessagesWithUser(
  { token, messageId, timestamp },
  socket = null,
  res = null
) {
  logInfo("getMessagesWithUser", "Start get message with user");
  return conversationWithUserV2({ token, messageId, timestamp }, socket, res);
}

/**
 * Lấy danh sách tin nhắn (dùng cho REST + Socket)
 */
async function getListMessages(
  { token, timestamp },
  socket = null,
  res = null
) {
  logInfo("getListMessages", "Start get list message");
  return listConversations({ token, timestamp }, socket, res);
}
async function getListMessagesV2(
  { token, timestamp },
  socket = null,
  res = null
) {
  logInfo("getListMessagesV2", "Start get list message");
  return listConversationsV2({ token, timestamp }, socket, res);
}

async function getListMoments(
  { token, timestamp, friendId, limit },
  socket = null,
  res = null
) {
  logInfo("getListMoments", "Start get list moments");
  return listMoments({ token, timestamp, friendId, limit }, socket, res);
}

module.exports = { getMessagesWithUser, getListMessages, getListMessagesV2, getListMoments };
