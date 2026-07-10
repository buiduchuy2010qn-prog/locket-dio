// src/socket/socketClient.js
import { API_ENDPOINTS, resolveSocketIoConfig } from "@/config/apiConfig";
import { io } from "socket.io-client";

export const createSocket = (idToken, { onConnect, onDisconnect, onError } = {}) => {
  if (!idToken) return null;

  const { url, path } = resolveSocketIoConfig(API_ENDPOINTS.socketUrl);

  // Prefer websocket; allow polling so relative /dio-api proxy still works
  // when the static host cannot upgrade WebSocket.
  const socketClient = io(url, {
    path,
    transports: ["websocket", "polling"],
    auth: { token: idToken },
    autoConnect: false,
    // ✅ RECONNECT CONFIG
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  // Trạng thái kết nối
  socketClient.on("connect", () => {
    console.log("Socket connected:", socketClient.id);
    onConnect?.(socketClient);
  });

  socketClient.on("disconnect", () => {
    console.log("Socket disconnected");
    onDisconnect?.();
  });

  socketClient.on("connect_error", (err) => {
    console.error("Connect error:", err.message);
    onError?.(err);
  });

  socketClient.connect();
  return socketClient;
};
