import { CONFIG } from "./webConfig";

// Official client: moments/messages on api.locket-dio.com (via /dio-api proxy)
// Socket also on api.locket-dio.com — NOT chat.locket-dio.com (DNS gone)
const isLocal =
  typeof window !== "undefined" && window.location.hostname === "localhost";

// Absolute API host for socket.io (cannot use relative path)
const API_HOST = "api.locket-dio.com";

// Namespace
export const API_NAMESPACE = {
  main: "/api",
  locket: "/locket",
  chat: "/chat",
};

// Endpoints — REST paths are relative so axios baseURL (/dio-api) proxies them
export const API_ENDPOINTS = {
  // Official: socketUrl = api base (default path /socket.io)
  socketUrl: isLocal
    ? `http://${API_HOST}`
    : `https://${API_HOST}`,

  // Relative → /dio-api/locket/...
  getAllMessages: "/locket/getAllMessageV2",
  getMessagesWithUser: "/locket/getMessageWithUserV2",
  getMoments: "/locket/getMomentV2",
};


export const PUBLIC_API = {
  feeds: "v1/public/feeds",
  donations: "v1/public/donations",
  timelines: "v1/public/timelines",
  frames: "v1/public/myframes",
  celebrates: "v1/public/getAllCelebrate",
  notifications: "v1/public/notification",
  plans: "v1/public/dio-plans",
  themes: "v1/public/themes",
  incidents: "v1/public/getAllIncident"
};