const CACHE_KEY = "weather_cache_v3";
/** Fresh enough to show immediately while revalidating */
const CACHE_DURATION = 10 * 60 * 1000;
/** Same spot if within ~1.5 km */
const MOVE_THRESHOLD_DEG = 0.015;

export const getCachedWeather = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    const isValid = Date.now() - parsed.timestamp < CACHE_DURATION;
    if (!isValid || !parsed.data) return null;

    return {
      data: parsed.data,
      lat: parsed.lat,
      lon: parsed.lon,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
};

export const setCachedWeather = (data, lat, lon) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        data,
        lat,
        lon,
        timestamp: Date.now(),
      }),
    );
  } catch {
    /* ignore quota */
  }
};

/** True if cache coords are still near current position */
export const isCacheNearLocation = (cached, lat, lon) => {
  if (
    cached == null ||
    lat == null ||
    lon == null ||
    cached.lat == null ||
    cached.lon == null
  ) {
    return false;
  }
  return (
    Math.abs(cached.lat - lat) < MOVE_THRESHOLD_DEG &&
    Math.abs(cached.lon - lon) < MOVE_THRESHOLD_DEG
  );
};
