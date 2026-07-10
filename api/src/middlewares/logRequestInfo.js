const { logTableRequest } = require("../utils/logCustome/logTableRequest");
const { logInfo } = require("../utils/logEventUtils");

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return (
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    "Unknown IP"
  );
};

/**
 * Log request + optional bot block.
 * Mặc định KHÔNG chặn thiếu Origin (browser same-origin / mobile / tool).
 * Bật STRICT_BOT_BLOCK=true nếu muốn chặn curl/python (production lock-down).
 */
const logRequestInfo = (req, res, next) => {
  const { email } = req.body || {};
  const ip = getClientIp(req);
  const origin = req.headers.origin || req.headers.referer || "";
  const userAgent = req.headers["user-agent"] || "";
  const method = req.method;
  const url = req.originalUrl;
  const time = new Date().toISOString();

  const data = {
    Time: time,
    IP: ip,
    Origin: origin || "(none)",
    "User-Agent": userAgent || "(none)",
    Method: method,
    URL: url,
  };

  logTableRequest(
    "logRequestInfo",
    data,
    `📡 ${method} ${url} - ${email || ""}`
  );

  // Chỉ chặn bot khi bật STRICT_BOT_BLOCK (không bật mặc định — tránh chặn app/proxy)
  if (process.env.STRICT_BOT_BLOCK === "true") {
    const ua = userAgent.toLowerCase();
    const suspiciousAgents = [
      "python-requests",
      "curl/",
      "wget",
      "go-http-client",
      "postmanruntime",
    ];
    if (suspiciousAgents.some((agent) => ua.includes(agent))) {
      logInfo("[BLOCKED] Access denied: Suspicious user-agent");
      return res.status(403).json({
        success: false,
        error: "Permission Denied",
      });
    }
  }

  next();
};

module.exports = { logRequestInfo };
