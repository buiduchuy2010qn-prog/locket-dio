const { createClient } = require("redis");
const { logSuccess, logError } = require("../../utils/logEventUtils");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// Publisher
const pubClient = createClient({
  url: redisUrl,
  socket: {
    connectTimeout: 4000,
    reconnectStrategy: (retries) => {
      if (retries > 5) return false; // stop reconnect spam
      return Math.min(retries * 200, 2000);
    },
  },
});

// Subscriber
const subClient = pubClient.duplicate();

pubClient.on("error", (err) => {
  // tránh spam log mỗi lần retry
  if (err?.code !== "ECONNREFUSED") {
    logError("Redis Pub Error:", err?.message || err);
  }
});

subClient.on("error", (err) => {
  if (err?.code !== "ECONNREFUSED") {
    logError("Redis Sub Error:", err?.message || err);
  }
});

async function connectRedis() {
  // Không set REDIS_URL → bỏ qua hẳn (không spam ECONNREFUSED 6379)
  if (!process.env.REDIS_URL) {
    const err = new Error("REDIS_URL not set — single-instance mode");
    err.code = "REDIS_OPTIONAL_SKIP";
    throw err;
  }

  if (!pubClient.isOpen) {
    await pubClient.connect();
  }

  if (!subClient.isOpen) {
    await subClient.connect();
  }

  logSuccess("✅ Redis Pub/Sub", "Connected for Socket.IO");
}

module.exports = {
  pubClient,
  subClient,
  connectRedis,
};
