const appCheckConfig = {
  redisUrl: process.env.APPCHECK_REDIS_URL,

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
    deviceId: process.env.APPCHECK_DEVICE_ID,
  },
};

module.exports = appCheckConfig;
