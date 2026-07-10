const { logError, logInfo, logTable } = require("../../utils/logEventUtils");

const COLLAB_KEY = process.env.COLLAB_KEY || "default_collab_key";

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

module.exports = { verifyCollabToken };
