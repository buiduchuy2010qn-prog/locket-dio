/**
 * Locket Dio SW v2.3.7-no-auto-reload
 * - KHÔNG precache JS/CSS/HTML
 * - KHÔNG skipWaiting tự động → không cướp tab đang dùng → không tự reload
 * - User bấm "Cập nhật" mới SKIP_WAITING
 */
console.log("[SW] Locket Dio SW v2.3.7-no-auto-reload - loaded");

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// KHÔNG skipWaiting() trong install — chờ user / lần mở app sau
self.addEventListener("install", () => {
  // self.skipWaiting() intentionally omitted
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) =>
              /precache|workbox-precache|pages-v1|assets-v1/i.test(k) &&
              !/dio-fonts|dio-images|pages-v3|assets-v3/i.test(k)
          )
          .map((k) => {
            console.log("[SW] delete old cache", k);
            return caches.delete(k);
          })
      );
      // claim nhẹ — không force reload clients
      await self.clients.claim();
    })()
  );
});

// Chỉ precache asset tĩnh (ảnh/icon) — BỎ js/css/html khỏi precache
const rawManifest = self.__WB_MANIFEST || [];
const staticOnly = rawManifest.filter((entry) => {
  const url = typeof entry === "string" ? entry : entry?.url || "";
  if (!url) return false;
  if (/\.(js|mjs|css|html|webmanifest|map)$/i.test(url)) return false;
  if (url === "index.html" || url === "/index.html") return false;
  if (url === "sw.js" || url.endsWith("/sw.js")) return false;
  return true;
});
precacheAndRoute(staticOnly);
cleanupOutdatedCaches();
console.log(
  "[SW] precache static only:",
  staticOnly.length,
  "/",
  rawManifest.length
);

// SPA navigate: luôn ưu tiên mạng (tránh HTML cũ trỏ chunk chết)
registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "pages-v3",
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 8,
        maxAgeSeconds: 24 * 60 * 60,
      }),
    ],
  })
);

// JS / CSS: NetworkFirst — bản mới luôn được tải
registerRoute(
  ({ request }) =>
    request.destination === "script" || request.destination === "style",
  new NetworkFirst({
    cacheName: "assets-v3",
    networkTimeoutSeconds: 4,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 40,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  })
);

// Font CDN (CORS có thể fail trên onrender — cache nếu từng load được)
registerRoute(
  ({ url, request }) =>
    url.origin === "https://cdn.locket-dio.com" &&
    request.destination === "font" &&
    url.pathname.startsWith("/v1/fonts/"),
  new CacheFirst({
    cacheName: "dio-fonts-v1",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  })
);

registerRoute(
  ({ url, request }) =>
    url.origin === "https://cdn.locket-dio.com" &&
    request.destination === "image" &&
    url.pathname.startsWith("/v1/images/"),
  new CacheFirst({
    cacheName: "dio-images-v1",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  })
);

self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  const notificationTitle = data.title || "🔔 Thông báo";
  const notificationOptions = {
    body: data.body || "Bạn có thông báo mới!",
    data: { url: data.url || "/" },
    icon: "/android-chrome-192x192.png",
    badge: "/maskable-icon-512x512.png",
  };
  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(urlToOpen);
      })
  );
});
