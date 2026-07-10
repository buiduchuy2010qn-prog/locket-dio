const { tokenUltils } = require("../../utils");
const {
  logError,
  logInfo,
  logTable,
  logWarning,
} = require("../../utils/logEventUtils");

/** Free plan attached when member JWT missing/invalid (self-host without Supabase). */
function freePlan(req) {
  const uid = req.user?.localId || req.user?.uid || "guest";
  return {
    uid,
    email: req.user?.email || null,
    name: req.user?.name || null,
    customer_code: `HL-${String(uid).slice(0, 6).toUpperCase()}`,
    plan_id: "free",
    is_active: true,
    expire_at: null,
    type: "session",
    free_local: true,
  };
}

const verifyDioToken = (req, res, next) => {
  try {
    const token =
      req.get("x-locketdio-member") ||
      req.get("X-LocketDio-Member") ||
      "";

    // Không có member token → free local (Huy Locket self-host)
    if (!token || token === "null" || token === "undefined") {
      logWarning(
        "verifyplanAuth",
        "⚠️ Không có member token — dùng free local plan",
      );
      req.plan = freePlan(req);
      return next();
    }

    const planData = tokenUltils.verifyToken(token);

    if (!planData) {
      // Token ký secret khác (hoặc hết hạn parse) → free local, không chặn upload
      logWarning(
        "verifyplanAuth",
        "⚠️ Plan token không hợp lệ — fallback free local",
      );
      req.plan = freePlan(req);
      return next();
    }

    // Check hết hạn
    if (planData.exp && planData.exp * 1000 < Date.now()) {
      logWarning(
        "verifyplanAuth",
        "⚠️ Plan token hết hạn — fallback free local",
      );
      req.plan = freePlan(req);
      return next();
    }

    if (req.user?.localId && planData.uid && req.user.localId !== planData.uid) {
      logWarning(
        "verifyplanAuth",
        "❌ Plan token không khớp user — fallback free local",
      );
      req.plan = freePlan(req);
      return next();
    }

    req.plan = planData;

    logInfo("verifyplanAuth", `✅ Plan token OK (${planData.plan_id})`);
    logTable("verifyplanAuth", planData, "PLAN TOKEN DATA");

    next();
  } catch (err) {
    logError("verifyplanAuth", err.message);
    // Không chặn flow — gói free local
    req.plan = freePlan(req);
    next();
  }
};

module.exports = { verifyDioToken };
