const { decodeJwt } = require("../utils/decode.js");
const { SocketEvents } = require("../models/socketModels.js");
const { simplifyFriends } = require("../simplify");
const { buildGetFriends } = require("../firestore/firestoreRequestBuilder.js");
const { handleGrpcStream } = require("../handlers");

function listFriends({ token }, socket, res) {
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
    buildRequest: () => buildGetFriends({ userId }),
    simplifyData: (response, uid) => simplifyFriends(response, uid),
    socketEvent: SocketEvents.NEW_ON_FRIENDS,
  });
}

module.exports = {
  listFriends,
};
