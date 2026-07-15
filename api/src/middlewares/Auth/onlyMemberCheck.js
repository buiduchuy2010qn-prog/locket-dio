const { logInfo, logError } = require("../../utils/logEventUtils");

/**
 * Huy Locket free-for-all: mọi user = Premium — không chặn Member-only.
 */
const onlyMemberCheck = async (req, res, next) => {
  try {
    logInfo(
      "onlyMemberCheck",
      `✅ Free-for-all pass (plan=${req.plan?.plan_id || "premium"})`,
    );
    return next();
  } catch (error) {
    logError("onlyMemberCheck", "❌ Error", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = { onlyMemberCheck };
