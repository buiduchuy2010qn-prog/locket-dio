const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
};

const healthController = (req, res) => {
  const uptime = Math.floor(process.uptime());
  const mem = process.memoryUsage();

  return res.status(200).json({
    success: true,
    status: "healthy",
    service: "huy-locket-api",
    name: "Huy Locket API",
    uptime_seconds: uptime,
    uptime_human: formatUptime(uptime),
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    server_time: new Date().toLocaleString("vi-VN", {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
    version: process.env.npm_package_version || "1.0.0",
    redis_configured: Boolean(process.env.REDIS_URL),
    weather_provider: process.env.WEATHER_API_KEY
      ? "weatherapi"
      : "open-meteo-fallback",
    memory_mb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    },
  });
};

module.exports = {
  healthController,
};
