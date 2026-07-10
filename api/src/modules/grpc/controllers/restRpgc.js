const { logInfo } = require("../../../utils/logEventUtils");
const {
  listConversations,
  conversationWithUserV2,
  listMoments,
  listFriends,
  listConversationsV2,
  getMomentReactions,
} = require("../services");

/**
 * Lấy tin nhắn 1 người dùng (dùng cho REST + Socket)
 */
async function getMessagesWithUser(req, res, next) {
  const { messageId, timestamp } = req.body;
  const { idToken } = req.user;
  logInfo("getMessagesWithUser", "Start get message with user");
  return conversationWithUserV2(
    { token: idToken, messageId, timestamp },
    null,
    res,
  );
}

/**
 * Lấy danh sách tin nhắn (dùng cho REST + Socket)
 */
async function getListMessages(req, res, next) {
  const { timestamp } = req.body;
  const { idToken } = req.user;
  logInfo("getListMessages", "Start get list message");
  return listConversations({ token: idToken, timestamp }, null, res);
}
async function getListMessagesV2(req, res, next) {
  const { timestamp } = req.body;
  const { idToken } = req.user;
  logInfo("getListMessagesV2", "Start get list message");
  return listConversationsV2({ token: idToken, timestamp }, null, res);
}

async function getListMoments(req, res, next) {
  const { timestamp, friendId, limit } = req.body;
  const { idToken } = req.user;
  logInfo("getListMoments", "Start get list moments");
  return listMoments({ token: idToken, timestamp, friendId, limit }, null, res);
}

async function getListFriends(req, res, next) {
  // const { timestamp, friendId, limit } = req.body;
  const { idToken } = req.user;
  logInfo("getListFriends", "Start get list friends");
  return listFriends({ token: idToken }, null, res);
}

async function getInfoMoments(req, res, next) {
  const { moment_uid } = req.body.data;
  const { idToken } = req.user;
  if (!moment_uid) {
    return res.status(400).json({
      error: "moment_uid is required",
    });
  }
  logInfo("getInfoMoments", "Start get get Info Moments");
  return getMomentReactions({ token: idToken, momentId: moment_uid }, null, res);
}

module.exports = {
  getMessagesWithUser,
  getListMessages,
  getListMessagesV2,
  getListMoments,
  getListFriends,
  getInfoMoments,
};
