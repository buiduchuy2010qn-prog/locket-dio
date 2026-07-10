const momentConfig = {
  redisUrl: process.env.POSTMOMENT_REDIS_URL,

  redisCache: {
    postMomentTTL: 60 * 60 * 24 * 2, // 2 days
  },

  webhook: {
    url: process.env.APPCHECK_WEBHOOK_URL,
    channels: {
      success: process.env.APPCHECK_WEBHOOK_SUCCESS,
      error: process.env.APPCHECK_WEBHOOK_ERROR,
    },
  },
};

module.exports = { momentConfig };
