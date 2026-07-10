const { client } = require("../clients/firestoreClient.js");
const { createMetadata } = require("../utils/CreMetadata.js");
const { SocketEvents } = require("../models/socketModels.js");
const { TargetChangeType } = require("../models/firebaseModels.js");

/**
 * Common handler for gRPC streams to Firestore
 *
 * @param {Object} options
 * @param {string} options.token - JWT token
 * @param {string} options.userId - User ID extracted from token
 * @param {Object} options.socket - Socket instance (optional)
 * @param {Object} options.res - Express response object (optional)
 * @param {string} options.databaseName - Firestore database name (e.g. "(default)", "locket")
 * @param {Function} options.buildRequest - Function returning the gRPC request object
 * @param {Function} options.simplifyData - Function to format the response data
 * @param {string} options.socketEvent - Socket event name to emit on new data
 */
function handleGrpcStream({
  token,
  userId,
  socket,
  res,
  databaseName = "(default)",
  buildRequest,
  simplifyData,
  socketEvent,
  formatResponse = (message) => ({ data: message, message: "ok" }),
}) {
  const metadata = createMetadata(token, databaseName);

  let message = [];
  let streamEnded = false;
  let isFirst = true;

  function safeSend(callback) {
    if (!streamEnded) {
      streamEnded = true;
      callback();
    }
  }

  const call = client.Listen(metadata);

  if (socket) {
    socket._grpcStream = call;

    socket.on("disconnect", () => {
      console.log("Socket disconnected, cleaning gRPC stream...");
      call.end();
    });
  }

  call.on("data", (response) => {
    const change = response.document_change?.document?.fields;
    const change_type = response.target_change?.target_change_type;

    if (change_type === TargetChangeType.NO_CHANGE) {
      if (!socket) {
        call.end();
        return;
      } else {
        if (isFirst) {
          isFirst = false;
        } else {
          socket.emit(socketEvent, message);
        }
        message = [];
      }
    }

    if (change) {
      const messageData = simplifyData(response, userId);
      message.push(messageData);
    }

    if (change_type === TargetChangeType.REMOVE) {
      safeSend(() => {
        if (res && !res.headersSent) {
          res.status(200).json({ isError: true, message: "Message removed" });
        }
        if (socket) {
          socket.emit(SocketEvents.ERROR, { error: "Message removed" });
        }
      });
      call.end();
      return;
    }
  });

  call.on("error", (err) => {
    console.error("gRPC Stream Error:", err.message);
    safeSend(() => {
      if (res && !res.headersSent) res.status(500).json({ error: err.message });
      if (socket) socket.emit(SocketEvents.ERROR, { error: err.message });
    });
  });

  call.on("end", () => {
    safeSend(() => {
      if (res && !res.headersSent) {
        res.status(200).json(formatResponse(message));
      }
    });
  });

  setTimeout(() => {
    if (!streamEnded && !socket) {
      console.log("Stream timeout. Closing connection...");
      call.end();
    }
  }, 30000);

  const request = buildRequest();
  call.write(request);
}

module.exports = {
  handleGrpcStream,
};
