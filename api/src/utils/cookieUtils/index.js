const { logInfo } = require("../logEventUtils");

const isProd = process.env.NODE_ENV === "production";

const TIME_MAP = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Parse time string: "30m", "1h", "7d"
 */
const parseTime = (time) => {
  if (typeof time === "number") return time;

  const match = /^(\d+)([smhd])$/.exec(time);
  if (!match) {
    throw new Error(`Invalid time format: ${time}`);
  }

  const [, value, unit] = match;
  return Number(value) * TIME_MAP[unit];
};

/**
 * Set auth cookie
 * @param {Response} res
 * @param {string} name
 * @param {string} value
 * @param {string|number} time  e.g "1h", "7d", 3600000
 */
const setCookie = ({ res, name, value, time }) => {
  logInfo("cookieUtils", `Setting cookie: ${name}, expires in: ${time}`);
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    domain: ".locket-dio.com",
    sameSite: "none",
    path: "/",
    maxAge: parseTime(time),
  });
};

const clearCookie = (res, name) => {
  logInfo("cookieUtils", `Clearing cookie: ${name}`);
  res.clearCookie(name, {
    httpOnly: true,
    secure: true,
    domain: ".locket-dio.com",
    sameSite: "none",
    path: "/",
  });
};

module.exports = {
  setCookie,
  clearCookie,
};
