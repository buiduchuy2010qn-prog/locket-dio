import { useState, useEffect, useCallback } from "react";
import { getInfoWeather } from "@/services";

const CACHE_KEY = "weather_cache_v2";
const CACHE_DURATION = 10 * 60 * 1000; // 10 phút

/** Map WMO weather_code (Open-Meteo) → icon weatherapi CDN + nhãn VN */
function mapWmoCode(code, isDay = true) {
  const day = isDay ? "day" : "night";
  const icon = (n) => `//cdn.weatherapi.com/weather/64x64/${day}/${n}.png`;

  // https://open-meteo.com/en/docs#weathervariables
  if (code === 0) return { condition: "Trời quang", icon: icon(113), wk: "clear" };
  if (code === 1) return { condition: "Ít mây", icon: icon(116), wk: "partlyCloudy" };
  if (code === 2) return { condition: "Có mây", icon: icon(119), wk: "cloudy" };
  if (code === 3) return { condition: "U ám", icon: icon(122), wk: "overcast" };
  if (code === 45 || code === 48)
    return { condition: "Sương mù", icon: icon(248), wk: "fog" };
  if (code >= 51 && code <= 55)
    return { condition: "Mưa phùn", icon: icon(266), wk: "drizzle" };
  if (code >= 56 && code <= 57)
    return { condition: "Mưa phùn đóng băng", icon: icon(281), wk: "freezingDrizzle" };
  if (code >= 61 && code <= 65)
    return { condition: "Mưa", icon: icon(302), wk: "rain" };
  if (code >= 66 && code <= 67)
    return { condition: "Mưa đóng băng", icon: icon(311), wk: "freezingRain" };
  if (code >= 71 && code <= 77)
    return { condition: "Tuyết", icon: icon(326), wk: "snow" };
  if (code >= 80 && code <= 82)
    return { condition: "Mưa rào", icon: icon(353), wk: "showers" };
  if (code >= 85 && code <= 86)
    return { condition: "Mưa tuyết", icon: icon(368), wk: "snowShowers" };
  if (code >= 95 && code <= 99)
    return { condition: "Dông", icon: icon(200), wk: "thunder" };
  return { condition: "Thời tiết", icon: icon(113), wk: "unknown" };
}

function normalizeCurrent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const temp =
    raw.temp_c ??
    raw.temperature_2m ??
    raw.temp ??
    (typeof raw.temperature === "number" && raw.temperature < 80
      ? raw.temperature
      : null);
  if (temp == null || Number.isNaN(Number(temp))) return null;

  const temp_c = Number(temp);
  const temp_c_rounded = Math.round(temp_c);
  let icon = raw.icon || "";
  if (icon && !icon.startsWith("//") && !icon.startsWith("http")) {
    icon = icon.startsWith("/") ? `//cdn.weatherapi.com${icon}` : icon;
  }

  return {
    temp_c,
    temp_c_rounded,
    condition: raw.condition || raw.condition_text || "Thời tiết",
    icon: icon || "//cdn.weatherapi.com/weather/64x64/day/113.png",
    temperature: raw.temperature ?? temp_c * 1.8 + 32,
    cloud_cover: raw.cloud_cover ?? raw.cloud ?? null,
    is_daylight: raw.is_daylight ?? raw.is_day ?? true,
    wk_condition: raw.wk_condition || raw.wk || "unknown",
  };
}

/** Open-Meteo — free, CORS OK, không cần API key */
async function fetchOpenMeteo(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,is_day,cloud_cover&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const cur = json.current;
  if (!cur) throw new Error("Open-Meteo: no current");

  const isDay = cur.is_day === 1 || cur.is_day === true;
  const mapped = mapWmoCode(Number(cur.weather_code), isDay);
  return {
    current: normalizeCurrent({
      temp_c: cur.temperature_2m,
      condition: mapped.condition,
      icon: mapped.icon,
      cloud_cover: (cur.cloud_cover ?? 0) / 100,
      is_daylight: isDay,
      wk_condition: mapped.wk,
    }),
    location: {
      name: "",
      lat,
      lon,
      tz_id: json.timezone || "",
    },
  };
}

/** Thử reverse geocode nhẹ (không chặn nếu fail) */
async function reversePlace(lat, lon) {
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client` +
      `?latitude=${lat}&longitude=${lon}&localityLanguage=vi`;
    const res = await fetch(url);
    if (!res.ok) return "";
    const j = await res.json();
    return (
      j.city ||
      j.locality ||
      j.principalSubdivision ||
      j.countryName ||
      ""
    );
  } catch {
    return "";
  }
}

/**
 * Lấy weather từ Dio API (nếu có) → fallback Open-Meteo (thật).
 * getInfoWeather() đã trả về `data` = { current, location } khi success.
 */
export async function fetchWeatherForCoords(lat, lon) {
  // 1) Dio backend
  try {
    const payload = await getInfoWeather({ lat, lon });
    // payload có thể là { current, location } hoặc nested
    const block = payload?.current
      ? payload
      : payload?.data?.current
        ? payload.data
        : payload?.data?.data?.current
          ? payload.data.data
          : null;

    if (block?.current) {
      const current = normalizeCurrent(block.current);
      if (current) {
        return {
          current,
          location: block.location || { lat, lon },
          source: "dio",
        };
      }
    }
    // Một số bản chỉ trả current trực tiếp
    const direct = normalizeCurrent(payload);
    if (direct) {
      return { current: direct, location: { lat, lon }, source: "dio" };
    }
  } catch (e) {
    console.warn("[weather] Dio API fail:", e?.message || e);
  }

  // 2) Open-Meteo thật
  const om = await fetchOpenMeteo(lat, lon);
  const place = await reversePlace(lat, lon);
  if (place && om.location) om.location.name = place;
  return { ...om, source: "open-meteo" };
}

export function useLocationWeather() {
  const [location, setLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    const now = Date.now();
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (now - parsed.timestamp < CACHE_DURATION && parsed.weather) {
            setLocation(parsed.location || null);
            setWeather(parsed.weather);
            setLoading(false);
            return;
          }
        }
      } catch {
        /* ignore bad cache */
      }
    }

    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ định vị");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const result = await fetchWeatherForCoords(latitude, longitude);
          if (!result?.current) {
            setError("Không lấy được thời tiết");
            setLoading(false);
            return;
          }
          setLocation(result.location);
          setWeather(result.current);
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              timestamp: Date.now(),
              location: result.location,
              weather: result.current,
              source: result.source,
            })
          );
        } catch (e) {
          console.error("[weather]", e);
          setError(e?.message || "Lỗi thời tiết");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.warn("[weather] geolocation:", err?.message || err);
        setError(
          err?.code === 1
            ? "Cần cho phép vị trí để xem thời tiết"
            : "Không lấy được vị trí"
        );
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return { location, weather, loading, error, refresh: () => load(true) };
}
