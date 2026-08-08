function createMemoryRedisFallback() {
  const values = new Map();
  const expirations = new Map();

  const clearIfExpired = (key) => {
    const expiresAt = expirations.get(key);
    if (expiresAt && Date.now() >= expiresAt) {
      values.delete(key);
      expirations.delete(key);
      return true;
    }
    return false;
  };

  const toStoredValue = (value) => (
    typeof value === "string" ? value : JSON.stringify(value)
  );

  return {
    isFallback: true,

    connect: async () => {},
    publish: async () => 0,
    subscribe: async () => {},
    unsubscribe: async () => {},

    set: async (key, value, options = {}) => {
      clearIfExpired(key);
      if (options?.NX && values.has(key)) return null;

      values.set(key, toStoredValue(value));
      if (Number(options?.EX) > 0) {
        expirations.set(key, Date.now() + Number(options.EX) * 1000);
      } else {
        expirations.delete(key);
      }
      return "OK";
    },

    get: async (key) => {
      if (clearIfExpired(key)) return null;
      return values.has(key) ? values.get(key) : null;
    },

    del: async (key) => {
      clearIfExpired(key);
      const existed = values.delete(key);
      expirations.delete(key);
      return existed ? 1 : 0;
    },

    exists: async (key) => {
      if (clearIfExpired(key)) return 0;
      return values.has(key) ? 1 : 0;
    },

    expire: async (key, seconds) => {
      if (clearIfExpired(key) || !values.has(key)) return 0;
      expirations.set(key, Date.now() + Number(seconds) * 1000);
      return 1;
    },

    quit: async () => {},
    on: () => {},
  };
}

module.exports = { createMemoryRedisFallback };
