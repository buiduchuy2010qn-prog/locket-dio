const { createClient } = require("redis");
const {
  logSuccess,
  logError,
  logWarning,
} = require("../../../utils/logEventUtils");

const { momentConfig } = require("../config");

const redisUrl = momentConfig.redisUrl;

// fallback client
const createFallbackRedis = () => ({
  isFallback: true,

  connect: async () => {},

  publish: async () => 0,

  subscribe: async () => {},

  unsubscribe: async () => {},

  set: async () => "OK",

  get: async () => null,

  del: async () => 0,

  exists: async () => 0,

  quit: async () => {},

  on: () => {},
});

let redisMoment;

if (!redisUrl) {
  logWarning("⚠️ [Redis Moment]", "Redis URL missing, using fallback client");

  redisMoment = createFallbackRedis();
} else {
  redisMoment = createClient({
    url: redisUrl,
  });

  redisMoment.on("error", (err) => {
    logError("[Redis Moment Error]", err);
  });

  (async () => {
    try {
      await redisMoment.connect();

      logSuccess("✅ [Redis Moment]", "Connected to Redis for Moment");
    } catch (err) {
      logError("[Redis Moment Connect Error]", err);

      redisMoment = createFallbackRedis();
    }
  })();
}

module.exports = { redisMoment };
