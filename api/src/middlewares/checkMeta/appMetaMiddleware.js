const { logTable } = require("../../utils/logEventUtils");

const checkAppMeta = (req, res, next) => {
  const appMeta = {
    author: req.headers["x-app-author"],
    appName: req.headers["x-app-name"],
    client: req.headers["x-app-client"],
    api: req.headers["x-app-api"],
    env: req.headers["x-app-env"],
  };

  // ✅ Log ra
  logTable("📦 App Meta:", appMeta);

  // ✅ Check thiếu header
  const missingFields = Object.entries(appMeta)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingFields.length > 0) {
    return res.status(403).json({
      success: false,
      message: "Malformed request",
    });
  }

  // (optional) attach vào req để dùng tiếp
  req.appMeta = appMeta;

  next();
};

module.exports = {
  checkAppMeta,
};
