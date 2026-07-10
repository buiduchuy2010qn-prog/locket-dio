const { createClient } = require("redis");
const {
  logSuccess,
  logError,
  logWarning,
} = require("../../../utils/logEventUtils");

const appCheckConfig = require("../config");

const redisUrl = appCheckConfig.redisUrl;

// fallback redis client
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

  expire: async () => 0,

  quit: async () => {},

  on: () => {},
});

let redisAppCheck;

if (!redisUrl) {
  logWarning("⚠️ [Redis AppCheck]", "Redis URL missing, using fallback client");

  redisAppCheck = createFallbackRedis();
} else {
  redisAppCheck = createClient({
    url: redisUrl,
  });

  redisAppCheck.on("error", (err) => {
    logError("[Redis AppCheck Error]", err);
  });

  (async () => {
    try {
      await redisAppCheck.connect();

      logSuccess("✅ [Redis AppCheck]", "Connected to Redis for AppCheck");
    } catch (err) {
      logError("[Redis AppCheck Connect Error]", err);

      redisAppCheck = createFallbackRedis();
    }
  })();
}

module.exports = { redisAppCheck };
