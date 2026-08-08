const webPush = require("web-push");
const authServices = require("../../services/AuthSecurity/AuthServices");
const friendServices = require("../../services/LocketFriend/FriendsServices");
const requestServices = require("../../services/LocketFriend/RequestServices");
const { appCheckServices } = require("../appcheck/services");
const store = require("./store");
const notificationHistoryStore = require("./notificationHistoryStore");
const { encryptSecret, decryptSecret, getEncryptionKey } = require("./crypto");
const { sendConfiguredNotifications } = require("./notificationService");
const {
  computeTransition,
  decodeFirebaseUid,
  extractCelebritySnapshot,
} = require("./core");
const {
  MAX_AUTO_REQUEST_ATTEMPTS,
  getAutoRequestRetryDelayMs,
  normalizeAutoRequestFailure,
} = require("./autoRequestPolicy");

function readIntervalMs(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

const POLL_INTERVAL_MS = Math.min(
  3 * 60 * 1000,
  Math.max(5_000, readIntervalMs(process.env.SLOT_POLL_INTERVAL_MS, 45_000)),
);
const POLL_JITTER_MS = Math.min(2_000, Math.max(500, Math.floor(POLL_INTERVAL_MS * 0.15)));
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 150;
const ID_TOKEN_CACHE_MS = 45 * 60 * 1000;
const VAPID_CONFIG_KEY = "slot_monitor_vapid_v1";
let vapidPromise = null;
let workerTimer = null;
let workerRunning = false;
const userSessionCache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cacheUserIdToken(userUid, idToken) {
  if (!userUid || !idToken) return;
  userSessionCache.set(String(userUid), {
    idToken,
    expiresAt: Date.now() + ID_TOKEN_CACHE_MS,
  });
}

function getCachedUserIdToken(userUid) {
  const key = String(userUid || "");
  const cached = userSessionCache.get(key);
  if (!cached) return null;
  if (Date.now() >= Number(cached.expiresAt || 0)) {
    userSessionCache.delete(key);
    return null;
  }
  return cached.idToken || null;
}

async function getVapidKeys() {
  if (vapidPromise) return vapidPromise;

  vapidPromise = (async () => {
    const envPublic = String(process.env.VAPID_PUBLIC_KEY || "").trim();
    const envPrivate = String(process.env.VAPID_PRIVATE_KEY || "").trim();
    let keys = null;

    if (envPublic && envPrivate) {
      keys = { publicKey: envPublic, privateKey: envPrivate };
    } else {
      const stored = await store.getConfigValue(VAPID_CONFIG_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed?.publicKey && parsed?.privateKey) keys = parsed;
        } catch {
          /* regenerate below */
        }
      }

      if (!keys) {
        keys = webPush.generateVAPIDKeys();
        await store.setConfigValue(VAPID_CONFIG_KEY, JSON.stringify(keys));
        console.log("[slot-monitor] generated persistent VAPID key pair in database");
      }
    }

    webPush.setVapidDetails(
      String(process.env.VAPID_SUBJECT || "mailto:buiduchuy2010qn@gmail.com"),
      keys.publicKey,
      keys.privateKey,
    );
    return keys;
  })().catch((error) => {
    vapidPromise = null;
    throw error;
  });

  return vapidPromise;
}

async function getPublicConfig() {
  if (!store.isConfigured() || !getEncryptionKey()) {
    return {
      enabled: false,
      reason: !store.isConfigured()
        ? "DATABASE_UNAVAILABLE"
        : "ENCRYPTION_KEY_UNAVAILABLE",
      vapidPublicKey: null,
      pollIntervalMs: POLL_INTERVAL_MS,
    };
  }

  const keys = await getVapidKeys();
  return {
    enabled: true,
    vapidPublicKey: keys.publicKey,
    pollIntervalMs: POLL_INTERVAL_MS,
  };
}

async function validateAndSaveSession(userUid, refreshToken) {
  if (!refreshToken) {
    const error = new Error("Thiếu refresh token để bật Canh Slot 24/7.");
    error.code = "REFRESH_TOKEN_REQUIRED";
    error.status = 400;
    throw error;
  }

  const refreshed = await authServices.refreshIdToken(String(refreshToken));
  const idToken = refreshed?.id_token || refreshed?.access_token;
  const refreshedUid = decodeFirebaseUid(idToken);
  if (!idToken || !refreshedUid || String(refreshedUid) !== String(userUid)) {
    const error = new Error("Phiên đăng nhập không khớp tài khoản hiện tại.");
    error.code = "SLOT_SESSION_MISMATCH";
    error.status = 403;
    throw error;
  }

  const nextRefreshToken = refreshed?.refresh_token || refreshToken;
  await store.saveSession(userUid, encryptSecret(nextRefreshToken));
  cacheUserIdToken(userUid, idToken);
  return idToken;
}

async function enableBackgroundPush({ userUid, refreshToken, subscription, userAgent }) {
  await store.ensureSchema();
  await getVapidKeys();
  await validateAndSaveSession(userUid, refreshToken);
  if (subscription) {
    await store.upsertSubscription(userUid, subscription, userAgent);
  }
  return getPublicConfig();
}

async function refreshUserSession(userUid) {
  const cachedIdToken = getCachedUserIdToken(userUid);
  if (cachedIdToken) return cachedIdToken;

  const session = await store.getSession(userUid);
  if (!session?.enabled || !session?.refresh_token_enc) {
    const error = new Error("Không có phiên nền cho Canh Slot.");
    error.code = "SLOT_SESSION_MISSING";
    throw error;
  }

  const refreshToken = decryptSecret(session.refresh_token_enc);
  try {
    const refreshed = await authServices.refreshIdToken(refreshToken);
    const idToken = refreshed?.id_token || refreshed?.access_token;
    const uid = decodeFirebaseUid(idToken);
    if (!idToken || !uid || String(uid) !== String(userUid)) {
      throw new Error("Background session user mismatch");
    }
    const nextRefresh = refreshed?.refresh_token || refreshToken;
    await store.markSessionRefreshed(userUid, encryptSecret(nextRefresh));
    cacheUserIdToken(userUid, idToken);
    return idToken;
  } catch (error) {
    userSessionCache.delete(String(userUid));
    await store.markSessionError(userUid, error?.message || "Session refresh failed");
    throw error;
  }
}

async function recordWebPushDelivery(userUid, payload, eventId, status, error = null) {
  try {
    await notificationHistoryStore.recordDelivery({
      userUid,
      eventId,
      channel: "web-push",
      status,
      payload,
      errorCode: error?.code || "",
      errorMessage: error?.message || "",
    });
  } catch (historyError) {
    console.warn("[slot-monitor] web push history write failed", {
      userUid,
      code: historyError?.code || null,
    });
  }
}

async function sendPushToUser(userUid, payload, { eventId = "" } = {}) {
  await getVapidKeys();
  const subscriptions = await store.listSubscriptionsForUser(userUid);
  if (!subscriptions.length) {
    await recordWebPushDelivery(userUid, payload, eventId, "SKIPPED", {
      code: "NO_ACTIVE_SUBSCRIPTION",
      message: "Không có thiết bị Web Push đang hoạt động.",
    });
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      try {
        await webPush.sendNotification(subscription, body, { TTL: 120 });
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode = Number(error?.statusCode || error?.status);
        if (statusCode === 404 || statusCode === 410) {
          await store.deactivateSubscription(row.endpoint).catch(() => {});
        }
        console.warn("[slot-monitor] push failed", {
          userUid,
          statusCode: statusCode || null,
        });
      }
    }),
  );

  const deliveryStatus = sent > 0
    ? (failed > 0 ? "PARTIAL" : "SUCCESS")
    : "FAILED";
  await recordWebPushDelivery(
    userUid,
    payload,
    eventId,
    deliveryStatus,
    failed > 0
      ? {
          code: "WEB_PUSH_PARTIAL_FAILURE",
          message: `${failed} thiết bị Web Push gửi thất bại; ${sent} thiết bị thành công.`,
        }
      : null,
  );

  return { sent, failed };
}

async function sendRealCelebrityRequest(userUid, idToken, watch) {
  if (!watch?.auto_request_enabled) {
    return {
      enabled: false,
      attempted: false,
      success: null,
      code: null,
      message: null,
    };
  }

  let lastFailure = null;

  for (let attempt = 1; attempt <= MAX_AUTO_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      // Dùng chính App Check + API sendFollowRequest của Locket giống nút kết bạn Celeb thật.
      // Chỉ retry lỗi tạm thời; lỗi auth/logic không được spam upstream.
      const appCheckToken = await appCheckServices.getOrCreateAppCheckToken();
      const result = await requestServices.SendAddCelebrity(
        idToken,
        watch.celeb_uid,
        appCheckToken,
      );

      if (result?.success) {
        await store.markAutoRequestResult(userUid, watch.celeb_uid, {
          status: "SENT",
        });
        console.log("[slot-monitor] real celebrity request sent", {
          userUid,
          username: watch.username,
          attempt,
        });
        return {
          enabled: true,
          attempted: true,
          success: true,
          code: null,
          message: "Locket đã xác nhận yêu cầu Celeb.",
          attempts: attempt,
        };
      }

      lastFailure = normalizeAutoRequestFailure(result, {
        defaultCode: "UPSTREAM_REJECTED",
        defaultMessage: "Locket không chấp nhận yêu cầu Celeb.",
      });
    } catch (error) {
      lastFailure = normalizeAutoRequestFailure(error);
    }

    console.warn("[slot-monitor] real celebrity request attempt failed", {
      userUid,
      username: watch?.username,
      attempt,
      maxAttempts: MAX_AUTO_REQUEST_ATTEMPTS,
      source: lastFailure.source,
      status: lastFailure.status,
      code: lastFailure.code,
      message: lastFailure.message,
      retryable: lastFailure.retryable,
    });

    if (!lastFailure.retryable || attempt >= MAX_AUTO_REQUEST_ATTEMPTS) {
      break;
    }

    const retryDelayMs = getAutoRequestRetryDelayMs(attempt, lastFailure.status);
    console.log("[slot-monitor] retrying real celebrity request", {
      userUid,
      username: watch?.username,
      nextAttempt: attempt + 1,
      retryDelayMs,
    });
    await sleep(retryDelayMs);
  }

  const finalFailure = lastFailure || normalizeAutoRequestFailure(null);
  const statusSuffix = finalFailure.status ? ` [HTTP ${finalFailure.status}]` : "";
  await store.markAutoRequestResult(userUid, watch.celeb_uid, {
    status: "FAILED",
    error: `${finalFailure.code}${statusSuffix}: ${finalFailure.message}`,
  }).catch(() => {});

  console.warn("[slot-monitor] real celebrity request failed", {
    userUid,
    username: watch?.username,
    source: finalFailure.source,
    status: finalFailure.status,
    code: finalFailure.code,
    message: finalFailure.message,
    retryable: finalFailure.retryable,
    attempts: MAX_AUTO_REQUEST_ATTEMPTS,
  });

  return {
    enabled: true,
    attempted: true,
    success: false,
    code: finalFailure.code,
    message: finalFailure.message,
    status: finalFailure.status,
    retryable: finalFailure.retryable,
    attempts: MAX_AUTO_REQUEST_ATTEMPTS,
  };
}

async function checkOneWatch(userUid, idToken, watch, { notify = true } = {}) {
  try {
    const result = await friendServices.FindFriendByUserName(idToken, watch.username);
    const snapshot = extractCelebritySnapshot(result);
    if (!snapshot) throw new Error("Celebrity slot data unavailable");

    const transition = computeTransition(watch, snapshot);
    await store.updateWatchSnapshot(userUid, watch.celeb_uid, transition);

    if (notify && transition.shouldNotify) {
      const count = transition.availableSlots;
      const autoRequest = await sendRealCelebrityRequest(userUid, idToken, watch);
      let body = `@${watch.username} hiện còn ${count.toLocaleString("vi-VN")} slot trống. Nhấn để kết bạn ngay!`;
      let title = "🔥 Slot vừa mở!";

      if (autoRequest.success === true) {
        title = "⚡ Có slot — đã gửi request Celeb!";
        body = `@${watch.username} còn ${count.toLocaleString("vi-VN")} slot. Railway đã gửi yêu cầu kết bạn Celeb thật và Locket đã xác nhận.`;
      } else if (autoRequest.enabled && autoRequest.attempted) {
        title = "⚠️ Có slot nhưng tự kết bạn chưa thành công";
        body = `@${watch.username} còn ${count.toLocaleString("vi-VN")} slot. Locket chưa xác nhận request tự động; mở Duchi Locket để thử ngay.`;
      }

      const payload = {
        type: "slot-open",
        title,
        body,
        icon: watch.avatar_url || "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `slot-${watch.celeb_uid}`,
        url: `/friends?slot=1&username=${encodeURIComponent(watch.username)}`,
        celeb: {
          uid: watch.celeb_uid,
          username: watch.username,
          displayName: watch.display_name || watch.username,
          availableSlots: count,
          friendCount: transition.friendCount,
          maxFriends: transition.maxFriends,
        },
        autoRequest,
      };
      const eventId = [
        watch.celeb_uid,
        transition.friendCount,
        transition.maxFriends,
      ].join("-");

      await Promise.allSettled([
        sendPushToUser(userUid, payload, { eventId }),
        sendConfiguredNotifications(userUid, payload, { eventId }),
      ]);
    }

    return { ok: true, transition };
  } catch (error) {
    console.warn("[slot-monitor] celeb check failed", {
      userUid,
      username: watch.username,
      status: error?.response?.status || null,
      code: error?.code || null,
    });
    return { ok: false, error };
  }
}

async function checkUserWatches(userUid) {
  const idToken = await refreshUserSession(userUid);
  const watches = await store.listActiveWatchesForUser(userUid);

  for (let i = 0; i < watches.length; i += BATCH_SIZE) {
    const batch = watches.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((watch) => checkOneWatch(userUid, idToken, watch)));
    if (i + BATCH_SIZE < watches.length) await sleep(BATCH_DELAY_MS);
  }
}

async function runWorkerCycle() {
  if (workerRunning || !store.isConfigured() || !getEncryptionKey()) return;
  workerRunning = true;
  try {
    await store.ensureSchema();
    const users = await store.listActiveUsers();
    for (const row of users) {
      try {
        await checkUserWatches(row.user_uid);
      } catch (error) {
        console.warn("[slot-monitor] user cycle failed", {
          userUid: row.user_uid,
          code: error?.code || null,
        });
      }
    }
  } catch (error) {
    console.error("[slot-monitor] worker cycle failed", error?.message || error);
  } finally {
    workerRunning = false;
  }
}

function scheduleWorker() {
  const jitter = Math.floor((Math.random() * 2 - 1) * POLL_JITTER_MS);
  const delay = Math.max(5_000, POLL_INTERVAL_MS + jitter);
  workerTimer = setTimeout(async () => {
    await runWorkerCycle();
    scheduleWorker();
  }, delay);
  workerTimer.unref?.();
}

function startSlotMonitorWorker() {
  if (workerTimer || !store.isConfigured() || !getEncryptionKey()) {
    if (!store.isConfigured()) {
      console.warn("[slot-monitor] 24/7 worker disabled: DATABASE_URL missing");
    } else if (!getEncryptionKey()) {
      console.warn("[slot-monitor] 24/7 worker disabled: encryption secret missing");
    }
    return false;
  }

  console.log(
    `[slot-monitor] 24/7 Railway worker enabled (about every ${(POLL_INTERVAL_MS / 1000).toFixed(1)} seconds)`,
  );
  const startup = setTimeout(runWorkerCycle, 2_000);
  startup.unref?.();
  scheduleWorker();
  return true;
}

async function checkNowForUser(userUid, celebUid, idToken) {
  const watches = await store.listUserWatches(userUid);
  const watch = watches.find((item) => String(item.celeb_uid) === String(celebUid));
  if (!watch) {
    const error = new Error("Không tìm thấy Celeb đang canh.");
    error.status = 404;
    error.code = "SLOT_WATCH_NOT_FOUND";
    throw error;
  }
  return checkOneWatch(userUid, idToken, watch, { notify: true });
}

module.exports = {
  POLL_INTERVAL_MS,
  getPublicConfig,
  enableBackgroundPush,
  validateAndSaveSession,
  sendPushToUser,
  sendRealCelebrityRequest,
  checkNowForUser,
  runWorkerCycle,
  startSlotMonitorWorker,
};
