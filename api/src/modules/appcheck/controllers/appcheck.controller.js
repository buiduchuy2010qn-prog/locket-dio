const { logInfo, logError, logSuccess } = require("../../../utils/logEventUtils");
const { appCheckServices } = require("../services");
const { redisStore } = require("../redis");
const { sendAppCheckFailedWebhook } = require("../webhook");

// ======================
// REGISTER DEVICE TOKEN
// ======================

const registerAppCheckController = async (req, res, next) => {
  try {
    logInfo("appCheckController", "📩 Register device token");

    const { deviceToken } = req.body;

    if (!deviceToken) {
      return res.status(400).json({
        success: false,
        message: "deviceToken is required",
      });
    }

    await appCheckServices.registerDeviceToken(deviceToken);

    logSuccess("appCheckController", "✅ Device token saved");

    res.status(200).json({
      success: true,
      message: "Device token registered",
    });
  } catch (error) {
    logError(
      "appCheckController",
      "❌ Register AppCheck failed",
      error.message,
    );

    return next(error);
  }
};

// ======================
// GET APP CHECK TOKEN
// ======================

const getAppCheckController = async (req, res, next) => {
  try {
    logInfo("appCheckController", "📩 Get AppCheck token");

    const token = await appCheckServices.getOrCreateAppCheckToken();

    res.status(200).json({
      success: true,
      data: {
        token,
      },
    });
  } catch (error) {
    logError("appCheckController", "❌ Get AppCheck failed", error.message);

    const isSent = await redisStore.markWebhookSent();

    if (isSent) {
      await sendAppCheckFailedWebhook({
        message: error.message,
      });
      await redisStore.deleteDeviceToken();
    }
    
    return next(error);
  }
};

module.exports = {
  registerAppCheckController,
  getAppCheckController,
};
