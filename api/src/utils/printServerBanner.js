function printServerBanner({ isProd, PORT }) {
  const green = "\x1b[32m";
  const yellow = "\x1b[33m";
  const cyan = "\x1b[36m";
  const reset = "\x1b[0m";
  const bold = "\x1b[1m";

  const width = 40;

  const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, "");

  const line = (text) => {
    const clean = stripAnsi(text);
    const padding = width - clean.length;
    const left = Math.floor(padding / 2);
    const right = padding - left;
    return "║" + " ".repeat(left) + text + " ".repeat(right) + "║";
  };

  const row = (label, value) => {
    const content = `  ${label} : ${value}`;
    const clean = stripAnsi(content);
    return "║" + content + " ".repeat(Math.max(0, width - clean.length)) + "║";
  };

  console.log(`
╔${"═".repeat(width)}╗
${line(cyan + bold + "HUY LOCKET API" + reset)}
╠${"═".repeat(width)}╣
${row("MODE", isProd ? green + "PRODUCTION" + reset : yellow + "DEVELOPMENT" + reset)}
${row("NODE", cyan + (process.env.NODE_ENV || "development") + reset)}
${row("PORT", green + PORT + reset)}
${row("REDIS", process.env.REDIS_URL ? green + "CONFIGURED" + reset : yellow + "OPTIONAL" + reset)}
${row("WEATHER", process.env.WEATHER_API_KEY ? green + "WeatherAPI" + reset : yellow + "Open-Meteo" + reset)}
╚${"═".repeat(width)}╝
`);
}

module.exports = {
  printServerBanner,
};
