const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const apiRoot = path.resolve(__dirname, "..");
const servicePath = path.join(
  apiRoot,
  "src/modules/appcheck/services/appcheck.service.js",
);
const configPath = path.join(apiRoot, "src/modules/appcheck/config/index.js");
const redisIndexPath = path.join(apiRoot, "src/modules/appcheck/redis/index.js");
const libsPath = path.join(apiRoot, "src/libs/index.js");
const logPath = path.join(apiRoot, "src/utils/logEventUtils.js");

function mockModule(modulePath, exports) {
  require.cache[require.resolve(modulePath)] = {
    id: require.resolve(modulePath),
    filename: require.resolve(modulePath),
    loaded: true,
    exports,
  };
}

function loadService({ deviceToken = null } = {}) {
  delete require.cache[require.resolve(servicePath)];

  mockModule(configPath, {
    deviceToken: { deviceId: "test-app-id" },
  });
  mockModule(redisIndexPath, {
    redisStore: {
      getDeviceToken: async () => deviceToken,
      getAppCheckToken: async () => null,
      saveAppCheckToken: async () => {},
      saveDeviceToken: async () => {},
    },
  });
  mockModule(libsPath, {
    instanceAppcheck: {
      post: async () => ({ data: { token: "generated", ttl: "3600s" } }),
    },
  });
  mockModule(logPath, {
    logInfo: () => {},
    logError: () => {},
  });

  return require(servicePath);
}

test("prefers configured legacy App Check token", async () => {
  const previous = process.env.LOCKET_APP_CHECK_TOKEN;
  process.env.LOCKET_APP_CHECK_TOKEN = "configured-app-check";

  try {
    const service = loadService();
    assert.equal(
      await service.getOrCreateAppCheckToken(),
      "configured-app-check",
    );
  } finally {
    if (previous === undefined) delete process.env.LOCKET_APP_CHECK_TOKEN;
    else process.env.LOCKET_APP_CHECK_TOKEN = previous;
  }
});

test("returns null when no configured token or DeviceCheck token exists", async () => {
  const previous = process.env.LOCKET_APP_CHECK_TOKEN;
  delete process.env.LOCKET_APP_CHECK_TOKEN;

  try {
    const service = loadService({ deviceToken: null });
    assert.equal(await service.getOrCreateAppCheckToken(), null);
  } finally {
    if (previous === undefined) delete process.env.LOCKET_APP_CHECK_TOKEN;
    else process.env.LOCKET_APP_CHECK_TOKEN = previous;
  }
});

test("still exchanges a stored DeviceCheck token", async () => {
  const previous = process.env.LOCKET_APP_CHECK_TOKEN;
  delete process.env.LOCKET_APP_CHECK_TOKEN;

  try {
    const service = loadService({
      deviceToken: { device_token: "device-check", limited_use: false },
    });
    assert.equal(await service.getOrCreateAppCheckToken(), "generated");
  } finally {
    if (previous === undefined) delete process.env.LOCKET_APP_CHECK_TOKEN;
    else process.env.LOCKET_APP_CHECK_TOKEN = previous;
  }
});
