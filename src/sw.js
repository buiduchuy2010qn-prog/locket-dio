/**
 * Huy Locket Service Worker (injectManifest)
 * - Precache app shell (hashed assets via Workbox manifest)
 * - Navigation: network-first + short timeout → always cached shell (never ERR_FAILED)
 * - /assets/*: cache-first (immutable hashes)
 * - API / Firebase / Locket / non-GET: network-only
 * - No skipWaiting on updates until client sends SKIP_WAITING
 * - Never Background Sync for posts
 */

const SW_VERSION = import.meta.env.VITE_APP_VERSION;
const SHELL_CACHE = "hl-app-shell-v2";
const PAGES_CACHE = "hl-pages-v2";

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
// First install (no active SW): skipWaiting so offline works after one visit.
// Updates: wait for client SKIP_WAITING — avoids mid-edit chunk mismatch.
// ======================
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  // First SW only — activate ASAP after install finishes (workbox precache waitUntil).
  // Updates stay waiting until client SKIP_WAITING.
  if (!self.registration.active) {
    self.skipWaiting();
  }
  // Do NOT warm shell here — precache may still be empty (parallel install handlers).
  // warmShellCache runs on activate after precache is ready.
  event.waitUntil(Promise.resolve());
});

async function resolveShellResponse() {
  const keys = ["index.html", "/index.html"];
  for (const key of keys) {
    try {
      const hit = await matchPrecache(key);
      if (hit) return hit;
    } catch {
      /* continue */
    }
  }
  try {
    const handler = createHandlerBoundToURL("index.html");
    return await handler({
      request: new Request("/index.html"),
      url: new URL("/index.html", self.location.origin),
      event: undefined,
    });
  } catch {
    /* continue */
  }
  for (const key of ["/index.html", "index.html", "/offline.html", "offline.html"]) {
    try {
      const hit = await caches.match(key, { ignoreSearch: true, ignoreVary: true });
      if (hit) return hit;
    } catch {
      /* continue */
    }
  }
  // Scan workbox precache caches for index.html (revision query safe)
  try {
    const names = await caches.keys();
    for (const name of names) {
      if (!/precache|workbox/i.test(name)) continue;
      const cache = await caches.open(name);
      const reqs = await cache.keys();
      for (const req of reqs) {
        if (/\/index\.html(?:\?|$)/.test(req.url) || req.url.endsWith("/index.html")) {
          const res = await cache.match(req);
          if (res) return res;
        }
      }
      // Relative key form
      for (const req of reqs) {
        if (req.url.includes("index.html")) {
          const res = await cache.match(req);
          if (res) return res;
        }
      }
    }
  } catch {
    /* continue */
  }
  return null;
}

async function warmShellCache() {
  try {
    // Wait a tick so injectManifest install can populate precache first when called from activate
    const shell = await resolveShellResponse();
    if (!shell) return;
    const cache = await caches.open(SHELL_CACHE);
    const clone = async () => shell.clone();
    // Routes users open offline (SPA). Server rewrite not available offline.
    await cache.put(new Request("/index.html"), await clone());
    await cache.put(new Request("/"), await clone());
    await cache.put(new Request("/locket"), await clone());
    try {
      const offline = await matchPrecache("offline.html");
      if (offline) {
        await cache.put(new Request("/offline.html"), offline.clone());
      }
    } catch {
      /* optional */
    }
  } catch (err) {
    console.warn("[SW] warmShellCache failed", err);
  }
}

async function navigationFallback() {
  // 1) Dedicated shell cache (stable keys, no __WB_REVISION__)
  try {
    const cache = await caches.open(SHELL_CACHE);
    for (const path of ["/index.html", "/", "/locket"]) {
      const hit = await cache.match(path, { ignoreSearch: true });
      if (hit) return hit;
    }
  } catch {
    /* continue */
  }

  // 2) Workbox precache / pages cache
  const shell = await resolveShellResponse();
  if (shell) return shell;

  try {
    const pages = await caches.open(PAGES_CACHE);
    const hit = await pages.match("/index.html", { ignoreSearch: true });
    if (hit) return hit;
  } catch {
    /* continue */
  }

  // 3) Never Response.error() for navigations — Chrome shows ERR_FAILED otherwise.
  return new Response(
    `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Huy Locket</title></head><body style="font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0f0f12;color:#f5f5f7;margin:0"><div style="text-align:center;padding:24px"><h1 style="font-size:1.2rem">Đang ngoại tuyến</h1><p style="opacity:.8">Mở lại khi có mạng để tải app shell. Bản nháp vẫn lưu trên máy.</p><button onclick="location.reload()" style="border:0;border-radius:999px;padding:10px 18px;background:#ffb800;font-weight:600">Thử lại</button></div></body></html>`,
    {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      cleanupOutdatedCaches();
      // Drop previous shell cache name if present
      try {
        await caches.delete("hl-app-shell-v1");
        await caches.delete("hl-pages-v1");
      } catch {
        /* ignore */
      }
      await warmShellCache();
      await self.clients.claim();
      console.log("[SW] activated + claimed", SW_VERSION);
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
    if (!url.pathname.startsWith("/v1/images/")) return true;
    if (url.search && /[Tt]oken=|[Ss]ignature=|X-Goog-/.test(url.search)) {
      return true;
    }
  }

  return false;
}

function isHashedAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/assets/")) return true;
  return /\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css|woff2?|ttf|png|svg|webp)$/.test(
    url.pathname,
  );
}

function isSpaNavigation({ request, url }) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.mode !== "navigate") return false;
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname || "/";
  // Never treat API / static build files as SPA navigations
  if (p.startsWith("/dio-") || p.startsWith("/api/")) return false;
  if (p.startsWith("/assets/")) return false;
  if (
    p === "/sw.js" ||
    p === "/manifest.webmanifest" ||
    p === "/offline.html" ||
    p === "/version.json" ||
    p === "/robots.txt" ||
    p === "/sitemap.xml"
  ) {
    return false;
  }
  // Real files with extensions (favicon.ico, icons, etc.) — not SPA routes
  if (/\.[a-zA-Z0-9]+$/.test(p) && p !== "/") return false;
  return true;
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
  ({ url, request }) => request.method === "GET" && isSensitiveApi(url),
  new NetworkOnly(),
);

// ======================
// HASHED STATIC ASSETS — cache-first
// ======================
registerRoute(
  ({ url, request }) => {
    if (request.method !== "GET") return false;
    if (isSensitiveApi(url)) return false;
    // AI enhance chunks use dedicated runtime cache (not shell precache)
    if (/ai-enhance-local|tensorflow|tfjs|upscaler|esrgan/i.test(url.pathname)) {
      return false;
    }
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
        maxEntries: 120,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  }),
);

// ======================
// ON-DEVICE AI — runtime cache only (after user taps AI Làm nét)
// Does NOT join app-shell precache; safe across shell updates.
// Model: same-origin /ai-models/esrgan-slim-2x/v1/* (versioned; immutable).
// Separate cache name from shell — app updates do not wipe model if version unchanged.
// ======================
registerRoute(
  ({ url, request }) => {
    if (request.method !== "GET") return false;
    if (url.origin !== self.location.origin) return false;
    // Lazy JS chunks (Upscaler / TF.js)
    if (/ai-enhance-local|tensorflow|tfjs|upscaler|esrgan/i.test(url.pathname)) {
      return true;
    }
    // Same-origin model weights (not external CDN)
    if (
      url.pathname.startsWith("/ai-models/") &&
      /\.(json|bin)$/i.test(url.pathname)
    ) {
      return true;
    }
    return false;
  },
  new CacheFirst({
    // Versioned path in URL → long TTL; bump cache name only if strategy changes
    cacheName: "hl-ai-models-v1",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 40,
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
// NAVIGATION — network-first, short timeout, ALWAYS shell fallback
// Covers `/` and `/locket` (and other SPA routes). Never ERR_FAILED.
// ======================
const navigationNetworkFirst = new NetworkFirst({
  cacheName: PAGES_CACHE,
  networkTimeoutSeconds: 2,
  plugins: [new CacheableResponsePlugin({ statuses: [200] })],
});

async function handleNavigation(params) {
  const { request, event } = params;
  try {
    const res = await navigationNetworkFirst.handle(params);
    if (res && res.ok) {
      // Mirror successful navigations into shell cache for offline re-open
      if (event?.waitUntil) {
        event.waitUntil(
          (async () => {
            try {
              const cache = await caches.open(SHELL_CACHE);
              const copy = res.clone();
              await cache.put(request, copy);
              await cache.put(new Request("/index.html"), res.clone());
            } catch {
              /* ignore */
            }
          })(),
        );
      }
      return res;
    }
  } catch {
    /* offline / timeout */
  }
  return navigationFallback();
}

registerRoute(
  new NavigationRoute(handleNavigation, {
    // Only skip true non-document paths; keep all SPA routes including /locket
    denylist: [
      /^\/assets\//,
      /^\/dio-/,
      /^\/api\//,
      /^\/sw\.js$/,
      /^\/manifest\.webmanifest$/,
      /^\/workbox-.*\.js$/,
      // Static files with extensions — but NOT extension-less SPA paths
      /\/[^/?]+\.[a-zA-Z0-9]+$/,
    ],
  }),
);

// Extra match for edge cases where mode=navigate but NavigationRoute misses
registerRoute(
  (ctx) => isSpaNavigation(ctx),
  handleNavigation,
);

// Offline fallback — NEVER Response.error() for document/navigate (Chrome ERR_FAILED)
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate" || request.destination === "document") {
    return navigationFallback();
  }
  // Non-navigation: fail closed without poisoning shell
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
