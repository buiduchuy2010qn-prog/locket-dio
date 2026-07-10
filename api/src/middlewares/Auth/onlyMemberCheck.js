const { logInfo, logError } = require("../../utils/logEventUtils");

const onlyMemberCheck = async (req, res, next) => {
  try {
    const planId = (req.plan?.plan_id || "free").toLowerCase();

    if (planId === "free") {
      logInfo("onlyMemberCheck", "⚠️ Blocked: Free plan");
      return res.status(400).json({
        success: false,
        message: "Member only",
      });
    }

    logInfo("onlyMemberCheck", "✅ Passed");
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
