const { decodeJwt } = require("../utils/decode.js");
const { SocketEvents } = require("../models/socketModels.js");
const {
  simplifyConvertions,
  simplifyConvertionsWithUser,
  simplifyConvertionsV2,
} = require("../simplify");
const {
  buildGetListMessageRequest,
  buildGetMessagesWithUserRequest,
} = require("../firestore/firestoreRequestBuilder.js");
const { handleGrpcStream } = require("../handlers");

function listConversations({ token, timestamp }, socket, res) {
  const userId = decodeJwt(token)?.user_id;

  if (!token || !userId) {
    if (res && !res.headersSent) {
      return res.json({ error: "Token and userId are required" });
    }
    if (socket) {
      return socket.emit(SocketEvents.ERROR, {
        error: "Token and userId are required",
      });
    }
    return;
  }

  handleGrpcStream({
    token,
    userId,
    socket,
    res,
    databaseName: "(default)",
    buildRequest: () => buildGetListMessageRequest(userId, timestamp),
    simplifyData: (response, uid) => simplifyConvertions(response, uid),
    socketEvent: SocketEvents.NEW_ON_LIST_MESSAGE,
  });
}

function listConversationsV2({ token, timestamp }, socket, res) {
  const userId = decodeJwt(token)?.user_id;

  if (!token || !userId) {
    if (res && !res.headersSent) {
      return res.json({ error: "Token and userId are required" });
    }
    if (socket) {
      return socket.emit(SocketEvents.ERROR, {
        error: "Token and userId are required",
      });
    }
    return;
  }

  handleGrpcStream({
    token,
    userId,
    socket,
    res,
    databaseName: "(default)",
    buildRequest: () => buildGetListMessageRequest(userId, timestamp),
    simplifyData: (response, uid) => simplifyConvertionsV2(response, uid),
    socketEvent: SocketEvents.NEW_ON_LIST_MESSAGE,
  });
}

function conversationWithUserV2({ token, messageId, timestamp }, socket, res) {
  const userId = decodeJwt(token)?.user_id;

  if (!token || !userId || !messageId) {
    if (res && !res.headersSent) {
      return res.json({ error: "Token and userId or messageId are required" });
    }
    if (socket) {
      return socket.emit(SocketEvents.ERROR, {
        error: "Token and userId or messageId are required",
      });
    }
    return;
  }

  handleGrpcStream({
    token,
    userId,
    socket,
    res,
    databaseName: "(default)",
    buildRequest: () => buildGetMessagesWithUserRequest(messageId, timestamp),
    simplifyData: (response, uid) => simplifyConvertionsWithUser(response, uid),
    socketEvent: SocketEvents.NEW_MESSAGE_WITH_USER,
  });
}

module.exports = {
  conversationWithUserV2,
  listConversations,
  listConversationsV2,
};
