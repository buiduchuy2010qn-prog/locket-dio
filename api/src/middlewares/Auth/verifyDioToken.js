const { tokenUltils } = require("../../utils");
const { logError, logInfo, logTable, logWarning } = require("../../utils/logEventUtils");

const verifyDioToken = (req, res, next) => {
  try {
    const token = req.get("x-locketdio-member");

    if (!token) {
      return res.status(403).json({
        success: false,
        message: "Malformed request",
      });
    }

    const planData = tokenUltils.verifyToken(token);

    if (!planData) {
      logError("verifyplanAuth", "❌ Plan token không hợp lệ");
      return res.status(400).json({
        success: false,
        message: "Invalid plan token",
      });
    }

    // Check hết hạn
    if (planData.exp * 1000 < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Plan token expired",
      });
    }

    if (req.user.localId !== planData.uid) {
      logWarning("verifyplanAuth", "❌ Plan token không khớp với user hiện tại");
      return res.status(403).json({
        success: false,
        message: "ok",
      });
    }

    req.plan = planData;

    logInfo("verifyplanAuth", `✅ Plan token OK (${planData.plan_id})`);

    logTable("verifyplanAuth", planData, "PLAN TOKEN DATA");

    next();
  } catch (err) {
    logError("verifyplanAuth", err.message);
    return res.status(403).json({
      success: false,
      message: "Malformed token",
    });
  }
};

module.exports = { verifyDioToken };
