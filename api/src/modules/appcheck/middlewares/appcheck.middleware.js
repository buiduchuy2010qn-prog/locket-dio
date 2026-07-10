const {
  logError,
  logInfo,
  logTable,
  logSuccess,
} = require("../../../utils/logEventUtils");
const { sendAppCheckFailedWebhook } = require("../webhook");
const { redisStore } = require("../redis");
const { appCheckServices } = require("../services");

const appCheckConfig = require("../config");

const COLLAB_KEY = appCheckConfig.collabKey;

// ======================
// VERIFY COLLAB TOKEN
// ======================

const verifyCollabToken = (req, res, next) => {
  try {
    const key = req.get("x-collab-key");

    if (!key) {
      return res.status(403).json({
        success: false,
        message: "Malformed request",
      });
    }

    if (key !== COLLAB_KEY) {
      logError("verifyCollabToken", "❌ Collab key không hợp lệ");

      return res.status(403).json({
        success: false,
        message: "Invalid collab key",
      });
    }

    req.collabKey = key;

    logInfo("verifyCollabToken", `✅ Collab key OK (${key})`);

    logTable("verifyCollabToken", { collabKey: key }, "COLLAB TOKEN DATA");

    next();
  } catch (err) {
    logError("verifyCollabToken", err.message);

    return res.status(403).json({
      success: false,
      message: "Malformed token",
    });
  }
};

// ======================
// INITIALIZE APP CHECK
// ======================

const initializeAppCheck = async (req, res, next) => {
  try {
    logInfo("initializeAppCheck", "📩 Initializing AppCheck");

    const token = await appCheckServices.getOrCreateAppCheckToken();

    if (!token) {
      logError("initializeAppCheck", "❌ Failed to get AppCheck token");

      return res.status(400).json({
        success: false,
        message: "Failed to initialize AppCheck",
      });
    }

    logSuccess("initializeAppCheck", "✅ AppCheck initialized");

    // attach vào req
    req.appcheck = {
      token,
    };

    next();
  } catch (error) {
    logError("initializeAppCheck", "❌ AppCheck error", error.message);
    const acquired = await redisStore.markWebhookSent();

    if (acquired) {
      await sendAppCheckFailedWebhook({
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = {
  verifyCollabToken,
  initializeAppCheck,
};
