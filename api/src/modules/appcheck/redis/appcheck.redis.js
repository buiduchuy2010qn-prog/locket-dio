const { redisAppCheck } = require("./redis.clients");
const slotStore = require("../../slotMonitor/store");
const {
  encryptSecret,
  decryptSecret,
  getEncryptionKey,
} = require("../../slotMonitor/crypto");

const DEVICE_KEY = "appcheck:device";
const TOKEN_KEY = "appcheck:token";
const PERSISTED_DEVICE_KEY = "appcheck_device_token_v1";

const ERROR_LOCK_KEY = "appcheck:error:webhook";

const appCheckConfig = require("../config");

const { deviceTokenTTL, appCheckTokenTTL } = appCheckConfig.redisCache;

function canUsePersistentFallback() {
  return slotStore.isConfigured() && Boolean(getEncryptionKey());
}

async function persistDeviceToken(serializedToken) {
  if (!canUsePersistentFallback()) return;

  const payload = JSON.stringify({
    token: serializedToken,
    expiresAt: Date.now() + deviceTokenTTL * 1000,
  });
  await slotStore.setConfigValue(PERSISTED_DEVICE_KEY, encryptSecret(payload));
}

async function readPersistedDeviceToken() {
  if (!canUsePersistentFallback()) return null;

  const encrypted = await slotStore.getConfigValue(PERSISTED_DEVICE_KEY);
  if (!encrypted) return null;

  try {
    const parsed = JSON.parse(decryptSecret(encrypted));
    if (!parsed?.token || Date.now() >= Number(parsed.expiresAt || 0)) {
      await slotStore.setConfigValue(PERSISTED_DEVICE_KEY, "").catch(() => {});
      return null;
    }
    return String(parsed.token);
  } catch (error) {
    console.warn("[Redis AppCheck] persisted device token unreadable", {
      code: error?.code || null,
    });
    return null;
  }
}

// ======================
// DEVICE TOKEN
// ======================

exports.saveDeviceToken = async (deviceToken) => {
  const serializedToken = JSON.stringify(deviceToken);

  await redisAppCheck.set(DEVICE_KEY, serializedToken, {
    EX: deviceTokenTTL,
  });

  await persistDeviceToken(serializedToken).catch((error) => {
    console.warn("[Redis AppCheck] persistent device token save failed", {
      code: error?.code || null,
    });
  });

  // ✅ reset error lock khi device token mới đăng ký
  await redisAppCheck.del(ERROR_LOCK_KEY);
};

exports.getDeviceToken = async () => {
  let serializedToken = await redisAppCheck.get(DEVICE_KEY);

  if (!serializedToken) {
    serializedToken = await readPersistedDeviceToken();
    if (serializedToken) {
      await redisAppCheck.set(DEVICE_KEY, serializedToken, {
        EX: deviceTokenTTL,
      }).catch(() => {});
    }
  }

  if (!serializedToken) return null;

  try {
    return JSON.parse(serializedToken);
  } catch {
    return null;
  }
};

exports.deleteDeviceToken = async () => {
  await redisAppCheck.del(DEVICE_KEY);
  if (slotStore.isConfigured()) {
    await slotStore.setConfigValue(PERSISTED_DEVICE_KEY, "").catch(() => {});
  }
};

// ======================
// APP CHECK TOKEN
// ======================

exports.saveAppCheckToken = async (token) => {
  await redisAppCheck.set(TOKEN_KEY, token, {
    EX: appCheckTokenTTL,
  });
};

exports.getAppCheckToken = async () => {
  const token = await redisAppCheck.get(TOKEN_KEY);
  return token;
};

// ======================
// ERROR WEBHOOK LOCK
// ======================

exports.markWebhookSent = async () => {
  const result = await redisAppCheck.set(ERROR_LOCK_KEY, "sent", {
    NX: true,
  });

  return result === "OK";
};
