const {
  buildGetAllMoments,
  buildGetMomentReactions,
} = require("../firestore/firestoreRequestBuilder");
const { handleGrpcStream } = require("../handlers");
const { SocketEvents } = require("../models/socketModels");
const { simplifyMoment, simplifyReactions } = require("../simplify");
const { decodeJwt } = require("../utils/decode");

function listMoments({ token, timestamp, friendId, limit }, socket, res) {
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
    databaseName: "locket",
    buildRequest: () =>
      buildGetAllMoments({ userId, timestamp, byUserId: friendId, limit }),
    simplifyData: (response) => simplifyMoment(response),
    socketEvent: SocketEvents.NEW_ON_MOMENTS,
  });
}

function getMomentReactions(
  { token, timestamp, momentId, limit },
  socket,
  res,
) {
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
    buildRequest: () =>
      buildGetMomentReactions({ userId, timestamp, momentId, limit }),
    simplifyData: (response) => simplifyReactions(response),
    // socketEvent: SocketEvents.NEW_ON_MOMENTS,
    formatResponse: (message) => ({
      data: {
        reactions: message,
        count: message.length,
      },
      message: "ok",
    }),
  });
}

module.exports = {
  listMoments,
  getMomentReactions,
};
