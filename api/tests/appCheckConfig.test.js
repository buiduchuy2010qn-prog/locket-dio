const test = require("node:test");
const assert = require("node:assert/strict");

const configPath = require.resolve("../src/modules/appcheck/config");
const KEYS = [
  "APPCHECK_DEVICE_ID",
  "LOCKET_APP_CHECK_DEVICE_ID",
  "APPCHECK_REDIS_URL",
  "REDIS_URL",
];
const DEFAULT_ID = "1:641029076083:ios:cc8eb46290d69b234fa606";

function withConfig(env, callback) {
  const previous = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  try {
    for (const key of KEYS) delete process.env[key];
    for (const [key, value] of Object.entries(env || {})) {
      if (value !== undefined && value !== null) process.env[key] = String(value);
    }

    delete require.cache[configPath];
    const config = require(configPath);
    callback(config);
  } finally {
    delete require.cache[configPath];
    for (const key of KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

test("App Check config always has the known Locket iOS app id", () => {
  withConfig({}, (config) => {
    assert.equal(config.deviceToken.deviceId, DEFAULT_ID);
  });
});

test("App Check config accepts documented and legacy device id variables", () => {
  withConfig({ LOCKET_APP_CHECK_DEVICE_ID: "documented-id" }, (config) => {
    assert.equal(config.deviceToken.deviceId, "documented-id");
  });

  withConfig(
    {
      APPCHECK_DEVICE_ID: "legacy-id",
      LOCKET_APP_CHECK_DEVICE_ID: "documented-id",
    },
    (config) => {
      assert.equal(config.deviceToken.deviceId, "legacy-id");
    },
  );
});

test("App Check can reuse shared Redis but prefers its dedicated Redis", () => {
  withConfig({ REDIS_URL: "redis://shared" }, (config) => {
    assert.equal(config.redisUrl, "redis://shared");
  });

  withConfig(
    {
      REDIS_URL: "redis://shared",
      APPCHECK_REDIS_URL: "redis://dedicated",
    },
    (config) => {
      assert.equal(config.redisUrl, "redis://dedicated");
    },
  );
});
