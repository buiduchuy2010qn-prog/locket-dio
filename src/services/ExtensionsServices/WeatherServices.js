import { instanceMain } from "@/libs";
import axios from "axios";

/** Open-Meteo current weather → shape gần weatherAPI / Dio */
async function fetchOpenMeteoCurrent(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,is_day,cloud_cover&timezone=auto`;
  const res = await axios.get(url);
  const cur = res.data?.current;
  if (!cur) return null;

  const code = Number(cur.weather_code);
  const isDay = cur.is_day === 1 || cur.is_day === true;
  // Map WMO → weatherapi condition code roughly
  let conditionCode = 1000;
  let text = "Trời quang";
  if (code === 1 || code === 2) {
    conditionCode = 1003;
    text = "Ít mây";
  } else if (code === 3) {
    conditionCode = 1009;
    text = "U ám";
  } else if (code === 45 || code === 48) {
    conditionCode = 1135;
    text = "Sương mù";
  } else if (code >= 51 && code <= 67) {
    conditionCode = 1183;
    text = "Mưa";
  } else if (code >= 71 && code <= 77) {
    conditionCode = 1213;
    text = "Tuyết";
  } else if (code >= 80 && code <= 82) {
    conditionCode = 1240;
    text = "Mưa rào";
  } else if (code >= 95) {
    conditionCode = 1276;
    text = "Dông";
  }

  const day = isDay ? "day" : "night";
  const iconNum =
    conditionCode === 1000
      ? 113
      : conditionCode === 1003
        ? 116
        : conditionCode === 1009
          ? 122
          : conditionCode === 1135
            ? 248
            : conditionCode === 1183
              ? 302
              : conditionCode === 1213
                ? 326
                : conditionCode === 1240
                  ? 353
                  : 200;

  const temp = Number(cur.temperature_2m);
  // Shape khớp transformWeatherToOverlay (weatherAPI-like)
  return {
    current: {
      temp_c: temp,
      temp_c_rounded: Math.round(temp),
      is_day: isDay ? 1 : 0,
      cloud: cur.cloud_cover ?? 0,
      condition: {
        text,
        code: conditionCode,
        icon: `//cdn.weatherapi.com/weather/64x64/${day}/${iconNum}.png`,
      },
      // legacy fields
      icon: `//cdn.weatherapi.com/weather/64x64/${day}/${iconNum}.png`,
      cloud_cover: (cur.cloud_cover ?? 0) / 100,
      is_daylight: isDay,
    },
    location: { lat, lon, name: "" },
  };
}

export const getInfoWeather = async ({ lat, lon }) => {
  if (lat == null || lon == null) {
    console.warn("⚠️ getInfoWeather: thiếu lat/lon");
    return null;
  }

  try {
    const res = await instanceMain.post("/api/weatherV3", { lat, lon });
    if (res?.data?.status === "success") {
      return res.data.data;
    }
  } catch (error) {
    console.warn("getInfoWeather Dio fail:", error.message);
  }

  try {
    return await fetchOpenMeteoCurrent(lat, lon);
  } catch (e) {
    console.error("getInfoWeather Open-Meteo:", e.message);
    return null;
  }
};

export const getInfoWeatherV1 = async ({ lat, lon }) => {
  if (lat == null || lon == null) {
    console.warn("⚠️ getInfoWeatherV1: thiếu lat/lon");
    return null;
  }

  try {
    const res = await instanceMain.post("/api/weatherV2", { lat, lon });
    if (res?.data?.status === "success" && res.data.data) {
      return res.data.data;
    }
  } catch (error) {
    console.warn("getInfoWeatherV1 Dio fail:", error.message);
  }

  try {
    return await fetchOpenMeteoCurrent(lat, lon);
  } catch (e) {
    console.error("getInfoWeatherV1 Open-Meteo:", e.message);
    return null;
  }
};

export const getTwilightInfo = async ({ lat, lon }) => {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
    const res = await axios.get(url);
    return {
      sunrise: new Date(res.data.daily.sunrise[0]),
      sunset: new Date(res.data.daily.sunset[0]),
    };
  } catch (error) {
    console.error("getTwilightInfo:", error.message);
    // Fallback: approximate
    const now = new Date();
    const sunrise = new Date(now);
    sunrise.setHours(6, 0, 0, 0);
    const sunset = new Date(now);
    sunset.setHours(18, 0, 0, 0);
    return { sunrise, sunset };
  }
};
