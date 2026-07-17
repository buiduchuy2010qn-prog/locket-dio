/**
 * Rollcall media helpers — URL resolve, progressive preload, safe net logs.
 * Never log tokens, cookies, or full signed URLs.
 */

import { replaceFirebaseWithCDN } from "@/utils/replace/replaceFirebaseWithCDN";
import { getImageSrc } from "@/utils/replace/replaceUrl";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)(\?|#|$)/i;

/** In-flight preload promises keyed by media id / url host+path (no query). */
const preloadInflight = new Map();
/** Soft memory of preloaded keys this session. */
const preloadedOk = new Set();

export function logRollcallNet(entry) {
  try {
    // Only timing / status / type — no secrets
    console.info("[rollcall:net]", {
      type: entry.type,
      status: entry.status ?? null,
      ms: entry.ms ?? null,
      mediaKind: entry.mediaKind ?? null,
      index: entry.index ?? null,
      count: entry.count ?? null,
      week: entry.week ?? null,
      year: entry.year ?? null,
      fromCache: entry.fromCache ?? null,
    });
  } catch {
    /* ignore */
  }
}

/** Host + path only (strip query/hash so signed tokens never log). */
export function mediaPathKey(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url.split("?")[0].split("#")[0];
  }
}

/**
 * Detect expired Google / Firebase signed URL from query params.
 * Returns true when Token expired or past expiry number.
 */
export function isSignedUrlExpired(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    const expires = u.searchParams.get("Expires") || u.searchParams.get("X-Goog-Expires");
    // Firebase download tokens are long-lived; Google Cloud signed use Expires (unix)
    if (expires && /^\d+$/.test(expires)) {
      const expSec = Number(expires);
      // If looks like unix seconds
      if (expSec > 1e9) return Date.now() / 1000 > expSec - 30;
    }
    // X-Goog-Date + X-Goog-Expires (seconds lifetime)
    const googDate = u.searchParams.get("X-Goog-Date");
    const googExp = u.searchParams.get("X-Goog-Expires");
    if (googDate && googExp) {
      // googDate: YYYYMMDDTHHmmssZ
      const m = googDate.match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/
      );
      if (m) {
        const start = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
        const lifetimeMs = Number(googExp) * 1000;
        return Date.now() > start + lifetimeMs - 30_000;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function isVideoMedia(itemOrUrl) {
  if (!itemOrUrl) return false;
  if (typeof itemOrUrl === "string") return VIDEO_EXT.test(itemOrUrl);
  const url =
    itemOrUrl.main_url ||
    itemOrUrl.video_url ||
    itemOrUrl.media_url ||
    itemOrUrl.url ||
    "";
  const mime =
    itemOrUrl.mime_type ||
    itemOrUrl.content_type ||
    itemOrUrl.media_type ||
    itemOrUrl.type ||
    "";
  if (typeof mime === "string" && mime.startsWith("video")) return true;
  if (itemOrUrl.is_video === true || itemOrUrl.media_type === "video") return true;
  return VIDEO_EXT.test(url) && !IMAGE_EXT.test(url);
}

/**
 * Direct CDN URL when possible — never base64, never full-file proxy except HEIC convert.
 */
export function resolveRollcallMediaUrl(rawUrl) {
  if (!rawUrl) return "";
  const cdn = replaceFirebaseWithCDN(rawUrl);
  return getImageSrc(cdn);
}

export function getRollcallThumbnailUrl(item) {
  if (!item) return "";
  const raw =
    item.thumbnail_url ||
    item.thumbnailUrl ||
    item.thumb_url ||
    item.preview_url ||
    item.poster_url ||
    (isVideoMedia(item) ? "" : item.main_url) ||
    "";
  return raw ? resolveRollcallMediaUrl(raw) : "";
}

export function getRollcallMainUrl(item) {
  if (!item) return "";
  const raw =
    item.main_url ||
    item.video_url ||
    item.media_url ||
    item.image_url ||
    item.url ||
    "";
  return raw ? resolveRollcallMediaUrl(raw) : "";
}

export function mediaIdOf(item, index = 0) {
  return item?.uid || item?.id || `idx-${index}-${mediaPathKey(item?.main_url || "")}`;
}

/**
 * Whether this slide should mount real media (current ± 1).
 */
export function shouldLoadMediaIndex(index, activeIndex) {
  return Math.abs(index - activeIndex) <= 1;
}

/**
 * Preload image into browser cache (deduped). No-op for video / empty.
 */
export function preloadRollcallImage(url, { id, priority = "low" } = {}) {
  if (!url || typeof window === "undefined") return Promise.resolve(false);
  if (isVideoMedia(url)) return Promise.resolve(false);

  const key = id || mediaPathKey(url);
  if (preloadedOk.has(key)) return Promise.resolve(true);
  if (preloadInflight.has(key)) return preloadInflight.get(key);

  const t0 = performance.now();
  const p = new Promise((resolve) => {
    const img = new Image();
    // Hint when supported
    try {
      if ("fetchPriority" in img) img.fetchPriority = priority;
    } catch {
      /* ignore */
    }
    img.decoding = "async";
    img.onload = () => {
      preloadedOk.add(key);
      preloadInflight.delete(key);
      logRollcallNet({
        type: "preload_image",
        status: 200,
        ms: Math.round(performance.now() - t0),
        mediaKind: "image",
      });
      resolve(true);
    };
    img.onerror = () => {
      preloadInflight.delete(key);
      logRollcallNet({
        type: "preload_image",
        status: "error",
        ms: Math.round(performance.now() - t0),
        mediaKind: "image",
      });
      resolve(false);
    };
    img.src = url;
  });

  preloadInflight.set(key, p);
  return p;
}

/**
 * Limited concurrency queue for warm preloads (neighbors only — callers decide).
 */
export async function preloadRollcallNeighbors(items, activeIndex, { concurrency = 2 } = {}) {
  if (!Array.isArray(items) || !items.length) return;

  const targets = [activeIndex, activeIndex + 1, activeIndex - 1]
    .filter((i, idx, arr) => arr.indexOf(i) === idx && i >= 0 && i < items.length)
    .map((i) => ({ i, item: items[i] }));

  // Active first (high), then neighbors
  const ordered = targets.sort((a, b) => {
    if (a.i === activeIndex) return -1;
    if (b.i === activeIndex) return 1;
    return a.i - b.i;
  });

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, ordered.length) }, async () => {
    while (cursor < ordered.length) {
      const my = ordered[cursor++];
      if (!my) break;
      const url = getRollcallMainUrl(my.item);
      if (!url || isVideoMedia(my.item)) continue;
      await preloadRollcallImage(url, {
        id: mediaIdOf(my.item, my.i),
        priority: my.i === activeIndex ? "high" : "low",
      });
    }
  });
  await Promise.allSettled(workers);
}

/** Module-level fetch dedupe for getRollcallPosts(week, year). */
const listFetchInflight = new Map();

export function getListFetchKey(week, year) {
  return `${year}-W${week}`;
}

export function getInflightListFetch(key) {
  return listFetchInflight.get(key);
}

export function setInflightListFetch(key, promise) {
  listFetchInflight.set(key, promise);
  const clear = () => {
    if (listFetchInflight.get(key) === promise) listFetchInflight.delete(key);
  };
  promise.then(clear, clear);
  return promise;
}
