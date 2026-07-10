const cacheStore = new Map();

const DEFAULT_TTL = 1000 * 60 * 60; // 1h

/**
 * Get cache by key
 */
const getCache = (key) => {
  const cached = cacheStore.get(key);
  if (!cached) return null;

  if (cached.expiredAt && Date.now() > cached.expiredAt) {
    cacheStore.delete(key);
    return null;
  }

  return cached.value;
};

/**
 * Set cache
 * @param {string} key
 * @param {any} value
 * @param {number|string} ttl  number(ms) | "30s" | "5m" | "1h" | "7d"
 */
const setCache = (key, value, ttl = DEFAULT_TTL) => {
  const expiredAt =
    ttl === 0 || ttl === null
      ? null // không hết hạn
      : Date.now() + parseTTL(ttl);

  cacheStore.set(key, {
    value,
    expiredAt,
  });
};

/**
 * Clear cache
 */
const clearCache = (key) => {
  if (key) cacheStore.delete(key);
  else cacheStore.clear();
};

/* ------------------ utils ------------------ */

const TTL_MAP = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const parseTTL = (ttl) => {
  if (typeof ttl === "number") return ttl;

  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}`);
  }

  const [, value, unit] = match;
  return Number(value) * TTL_MAP[unit];
};

module.exports = {
  getCache,
  setCache,
  clearCache,
};
