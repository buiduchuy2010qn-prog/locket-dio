const { createClient } = require("redis");
const {
  logSuccess,
  logError,
  logWarning,
} = require("../../../utils/logEventUtils");
const { createMemoryRedisFallback } = require("./memoryRedisFallback");

const appCheckConfig = require("../config");

const redisUrl = appCheckConfig.redisUrl;

let redisAppCheck;

if (!redisUrl) {
  logWarning("⚠️ [Redis AppCheck]", "Redis URL missing, using in-memory fallback client");

  redisAppCheck = createMemoryRedisFallback();
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

      redisAppCheck = createMemoryRedisFallback();
    }
  })();
}

module.exports = { redisAppCheck };
