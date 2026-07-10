const { socketRpgc, SocketNamespaces } = require("../modules/grpc");
const { logSuccess, logWarning } = require("../utils/logEventUtils");

function initChatSocket(io) {
  io.on("connection", (socket) => {
    logSuccess("🔌 Socket connected", socket.id);

    // Lấy danh sách hội thoại
    socket.on(SocketNamespaces.GET_LIST_MESSAGE, ({ timestamp, token }) => {
      socketRpgc.getListMessages({ token, timestamp }, socket);
    });

    socket.on(SocketNamespaces.GET_LIST_MESSAGE_V2, ({ timestamp, token }) => {
      socketRpgc.getListMessagesV2({ token, timestamp }, socket);
    });

    // Lấy tin nhắn với 1 người
    socket.on(
      SocketNamespaces.GET_LIST_MESSAGE_WITH_USER,
      ({ messageId, timestamp, token }) => {
        socketRpgc.getMessagesWithUser({ token, messageId, timestamp }, socket);
      },
    );

    // Lấy danh sách khoảnh khắc
    socket.on(
      SocketNamespaces.ON_MOMENTS,
      ({ timestamp, token, friendId, limit }) => {
        socketRpgc.getListMoments(
          { token, timestamp, friendId, limit },
          socket,
        );
      },
    );

    socket.on("disconnect", () => {
      logWarning("❌ Socket disconnected", socket.id);
    });
  });
}

module.exports = initChatSocket;
