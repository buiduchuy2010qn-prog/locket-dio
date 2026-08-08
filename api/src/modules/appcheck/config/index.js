const DEFAULT_LOCKET_IOS_APP_ID = "1:641029076083:ios:cc8eb46290d69b234fa606";

const appCheckConfig = {
  // AppCheck may use a dedicated Redis instance, but the shared Redis is also
  // safe because all keys in this module are namespaced with `appcheck:`.
  redisUrl: process.env.APPCHECK_REDIS_URL || process.env.REDIS_URL,

  redisCache: {
    deviceTokenTTL: 60 * 60 * 24 * 7, // 7 days
    appCheckTokenTTL: 55 * 60, // 55 minutes
  },

  collabKey: process.env.APPCHECK_COLLAB_KEY,

  webhook: {
    url: process.env.APPCHECK_WEBHOOK_URL,
    channels: {
      success: process.env.APPCHECK_WEBHOOK_SUCCESS,
      error: process.env.APPCHECK_WEBHOOK_ERROR,
    },
  },

  appCheckProxy: null,

  deviceToken: {
    // APPCHECK_DEVICE_ID is kept for backward compatibility. The repository's
    // documented variable is LOCKET_APP_CHECK_DEVICE_ID. If neither is set,
    // use Locket's public Firebase iOS app id already used elsewhere here.
    deviceId:
      process.env.APPCHECK_DEVICE_ID ||
      process.env.LOCKET_APP_CHECK_DEVICE_ID ||
      DEFAULT_LOCKET_IOS_APP_ID,
  },
};

module.exports = appCheckConfig;
