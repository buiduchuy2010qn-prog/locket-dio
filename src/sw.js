/**
 * Huy Locket Service Worker (injectManifest)
 * - Precache app shell (hashed assets via Workbox manifest)
 * - Navigation: network-first + short timeout → cached shell
 * - /assets/*: cache-first (immutable hashes)
 * - API / Firebase / Locket / non-GET: network-only
 * - No skipWaiting until client sends SKIP_WAITING (update button / next reload)
 * - Never Background Sync for posts
 */

const SW_VERSION = import.meta.env.VITE_APP_VERSION;

console.log(`[SW] Huy Locket SW ${SW_VERSION} - loaded`);

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  matchPrecache,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute, setCatchHandler } from "workbox-routing";
import {
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
} from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

// ======================
// UPDATE CONTROL
// Never auto skipWaiting — client sends SKIP_WAITING after user confirms
// (or on next full reload). Prevents mid-edit chunk mismatch.
// ======================
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  // Claim only after this SW becomes active (first install or post-SKIP_WAITING).
  // Because skipWaiting is user-gated, claim here is safe.
  event.waitUntil(
    (async () => {
      cleanupOutdatedCaches();
      await self.clients.claim();
    })(),
  );
});

// ======================
// PRECACHE (shell only — filtered by vite injectManifest globs)
// ======================
precacheAndRoute(self.__WB_MANIFEST || []);
console.log("[SW] started precache");

cleanupOutdatedCaches();

// ======================
// HELPERS
// ======================
function isNonGet(request) {
  return request.method && request.method !== "GET" && request.method !== "HEAD";
}

function isSensitiveApi(url) {
  const p = url.pathname || "";
  // App proxies + private backends
  if (
    p.startsWith("/dio-api") ||
    p.startsWith("/dio-auth") ||
    p.startsWith("/dio-data") ||
    p.startsWith("/dio-storage") ||
    p.startsWith("/dio-media") ||
    p.startsWith("/dio-export") ||
    p.startsWith("/dio-cdn") ||
    p.startsWith("/dio-payment") ||
    p.startsWith("/dio-r2") ||
    p.startsWith("/api/")
  ) {
    return true;
  }

  const h = url.hostname || "";
  // Locket / Firebase / Google identity — always network
  // (user media, auth, personal APIs — never cache)
  if (
    h.includes("locketcamera.com") ||
    h.includes("api.locket-dio.com") ||
    h.includes("auth.locket-dio.com") ||
    h.includes("data.locket-dio.com") ||
    h.includes("storage.locket-dio.com") ||
    h.includes("media.locket-dio.com") ||
    h.includes("export.locket-dio.com") ||
    h.includes("payment.locket-dio.com") ||
    h.includes("googleapis.com") ||
    h.includes("firebaseio.com") ||
    h.includes("firebase") ||
    h.includes("identitytoolkit") ||
    h.includes("securetoken.google.com") ||
    h.includes("firebasestorage.googleapis.com")
  ) {
    return true;
  }

  // Signed / user media on brand CDN — never long-cache
  if (h.includes("cdn.locket-dio.com") || h.includes("cdn.locketcamera.com")) {
    // Only allow non-API static brand images path in a dedicated route;
    // treat everything else on CDN as network-only (no signed URL cache)
    if (!url.pathname.startsWith("/v1/images/")) return true;
    if (url.search && /[Tt]oken=|[Ss]ignature=|X-Goog-/.test(url.search)) {
      return true;
    }
  }

  return false;
}

function isHashedAsset(url) {
  if (url.origin !== self.location.origin) return false;
  // Vite hashed files under /assets/
  if (url.pathname.startsWith("/assets/")) return true;
  // Hashed filename pattern name-Ab12cdEf.js
  return /\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css|woff2?|ttf|png|svg|webp)$/.test(
    url.pathname,
  );
}

// ======================
// NEVER CACHE mutations
// ======================
registerRoute(
  ({ request }) => isNonGet(request),
  new NetworkOnly(),
);

// ======================
// API / AUTH / PERSONAL — network only
// ======================
registerRoute(
  ({ url, request }) =>
    request.method === "GET" && isSensitiveApi(url),
  new NetworkOnly(),
);

// ======================
// HASHED STATIC ASSETS — cache-first
// ======================
registerRoute(
  ({ url, request }) => {
    if (request.method !== "GET") return false;
    if (isSensitiveApi(url)) return false;
    return (
      isHashedAsset(url) ||
      (url.origin === self.location.origin &&
        (request.destination === "script" ||
          request.destination === "style" ||
          request.destination === "font" ||
          request.destination === "worker") &&
        url.pathname.startsWith("/assets/"))
    );
  },
  new CacheFirst({
    cacheName: "hl-static-assets-v1",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  }),
);

// ======================
// Same-origin icons / small shell images (not user media / not feed)
// ======================
registerRoute(
  ({ url, request }) =>
    request.method === "GET" &&
    url.origin === self.location.origin &&
    request.destination === "image" &&
    (url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/pwa-icons/") ||
      /\/(favicon|apple-touch|android-chrome|maskable)/i.test(url.pathname)),
  new CacheFirst({
    cacheName: "hl-shell-images-v1",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 40,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

// Brand CDN static logos only (NOT rollcall/feed media; path-limited)
registerRoute(
  ({ url, request }) =>
    request.method === "GET" &&
    url.origin === "https://cdn.locket-dio.com" &&
    request.destination === "image" &&
    url.pathname.startsWith("/v1/images/") &&
    !url.search.includes("token="),
  new CacheFirst({
    cacheName: "hl-brand-images-v1",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 40,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
);

// ======================
// NAVIGATION — network-first, short timeout, shell fallback
// ======================
const shellHandler = createHandlerBoundToURL("index.html");

const navigationNetworkFirst = new NetworkFirst({
  cacheName: "hl-pages-v1",
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
  ],
});

registerRoute(
  new NavigationRoute(
    async (params) => {
      try {
        const res = await navigationNetworkFirst.handle(params);
        if (res) return res;
      } catch {
        /* fall through */
      }
      try {
        const precached = await matchPrecache("index.html");
        if (precached) return precached;
      } catch {
        /* fall through */
      }
      try {
        return await shellHandler(params);
      } catch {
        /* fall through */
      }
      const offline = await caches.match("/offline.html");
      if (offline) return offline;
      return new Response("Offline", {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    },
    {
      denylist: [
        /^\/assets\//,
        /^\/dio-/,
        /^\/api\//,
        /\/[^/?]+\.[^/]+$/, // files with extensions
      ],
    },
  ),
);

// Offline fallback for failed navigations / document
setCatchHandler(async ({ request }) => {
  if (request.destination === "document" || request.mode === "navigate") {
    const precached = await matchPrecache("index.html");
    if (precached) return precached;
    const offline = await caches.match("/offline.html");
    if (offline) return offline;
  }
  return Response.error();
});

// ======================
// PUSH (unchanged behavior)
// ======================
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};

  const title = data.title || "🔔 Thông báo";
  const urlToOpen = data?.url || self.location.origin;

  const options = {
    body: data.body || "Bạn có thông báo mới!",
    data: { url: urlToOpen },
    icon: "/android-chrome-192x192.png",
    badge: "/maskable-icon-512x512.png",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || self.location.origin;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      }),
  );
});
