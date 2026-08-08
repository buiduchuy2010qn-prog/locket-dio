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

function createAppCheckError(error) {
  const apiError = error?.response?.data?.error;
  const statusValue = Number(error?.response?.status);
  const status = Number.isFinite(statusValue) && statusValue > 0 ? statusValue : null;
  const message = apiError?.message || error?.message || "Generate AppCheck token failed";
  const wrapped = new Error(message);

  if (status === 429) wrapped.code = "APPCHECK_RATE_LIMITED";
  else if (status && status >= 500) wrapped.code = "APPCHECK_UPSTREAM_ERROR";
  else if (status === 401 || status === 403) wrapped.code = "APPCHECK_AUTH_FAILED";
  else wrapped.code = error?.code || "APPCHECK_GENERATION_FAILED";

  if (status) wrapped.status = status;
  return wrapped;
}

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
    const wrapped = createAppCheckError(error);

    logError(
      "appCheckService",
      "❌ Generate AppCheck token failed",
      apiError || wrapped.message,
    );

    throw wrapped;
  }
};

// ======================
// GET OR CREATE TOKEN
// ======================

const getOrCreateAppCheckToken = async () => {
  // Legacy-compatible path: older Locket requests could use a directly supplied
  // App Check token. Keep supporting it without committing any live token.
  const configuredToken = String(process.env.LOCKET_APP_CHECK_TOKEN || "").trim();
  if (configuredToken) {
    logInfo("appCheckService", "⚡ Using configured AppCheck token");
    return configuredToken;
  }

  // 1️⃣ lấy device token từ cache/persistent fallback
  const deviceToken = await redisStore.getDeviceToken();

  // The Celeb background worker can still try sendFollowRequest without an
  // App Check header. Let Locket decide whether the endpoint currently requires
  // App Check instead of failing locally before the real request is attempted.
  // HTTP 401/403 from Locket is then captured by the auto-request diagnostics.
  if (!deviceToken) {
    logInfo(
      "appCheckService",
      "ℹ️ Device token unavailable; continuing without AppCheck token",
    );
    return null;
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
