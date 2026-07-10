const appCheckConfig = require("../config");
const { instanceAppcheck } = require("../../../libs");
const { logInfo, logError } = require("../../../utils/logEventUtils");
const { redisStore } = require("../redis");

const { deviceId } = appCheckConfig.deviceToken;
// ======================
// REGISTER DEVICE TOKEN
// ======================

const registerDeviceToken = async (deviceToken) => {
  await redisStore.saveDeviceToken(deviceToken);
};

// ======================
// GENERATE TOKEN
// ======================

const generateAppCheckToken = async (deviceToken) => {
  try {
    const url = `v1/projects/locket-4252a/apps/${deviceId}:exchangeDeviceCheckToken`;    
    const body = {
      device_token: deviceToken.device_token,
      limited_use: deviceToken.limited_use || false,
    };    
    const result = await instanceAppcheck.post(url, body);

    const { token, ttl } = result.data;

    return {
      token,
      ttl,
    };
  } catch (error) {
    const apiError = error.response?.data?.error;

    const message = apiError?.message || error.message;    
    logError(
      "appCheckService",
      "❌ Generate AppCheck token failed",
      apiError || error.message,
    );

    throw new Error(message);
  }
};

// ======================
// GET OR CREATE TOKEN
// ======================

const getOrCreateAppCheckToken = async () => {
  // 1️⃣ lấy device token từ redis
  const deviceToken = await redisStore.getDeviceToken();

  if (!deviceToken) {
    throw new Error("Device token not found");
  }

  // 2️⃣ check cached token
  let cachedToken = await redisStore.getAppCheckToken();

  if (cachedToken) {
    logInfo("appCheckService", "⚡ Using cached AppCheck token");

    return cachedToken;
  }

  // 3️⃣ generate mới
  const generated = await generateAppCheckToken(deviceToken);

  // 4️⃣ save cache
  await redisStore.saveAppCheckToken(generated.token);

  return generated.token;
};

module.exports = {
  registerDeviceToken,
  generateAppCheckToken,
  getOrCreateAppCheckToken,
};
