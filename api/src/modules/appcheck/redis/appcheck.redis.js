const { redisAppCheck } = require("./redis.clients");

const DEVICE_KEY = "appcheck:device";
const TOKEN_KEY = "appcheck:token";

const ERROR_LOCK_KEY = "appcheck:error:webhook";

const appCheckConfig = require("../config");

const { deviceTokenTTL, appCheckTokenTTL } = appCheckConfig.redisCache;
// ======================
// DEVICE TOKEN
// ======================

exports.saveDeviceToken = async (deviceToken) => {
  // lưu token mới
  await redisAppCheck.set(DEVICE_KEY, deviceToken, {
    EX: deviceTokenTTL,
  });

  // ✅ reset error lock khi device token mới đăng ký
  await redisAppCheck.del(ERROR_LOCK_KEY);
};

exports.getDeviceToken = async () => {
  const deviceToken = await redisAppCheck.get(DEVICE_KEY);
  return deviceToken ? JSON.parse(deviceToken) : null;
};

exports.deleteDeviceToken = async () => {
  // xoá device token
  await redisAppCheck.del(DEVICE_KEY);
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
