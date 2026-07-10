const axios = require("axios");
const serverConfig = require("../../../config/app.config");
const { transformWeatherToOverlay } = require("../utils");

/**
 * Open-Meteo fallback — không cần API key, CORS/server-side OK.
 * Shape giống WeatherAPI current.json (client / transformWeatherToOverlay).
 */
async function fetchOpenMeteoAsWeatherApi(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,weather_code,is_day,cloud_cover,relative_humidity_2m,wind_speed_10m&timezone=auto`;
  const res = await axios.get(url, { timeout: 12000 });
  const cur = res.data?.current;
  if (!cur) throw new Error("Open-Meteo: no current data");

  const code = Number(cur.weather_code);
  const isDay = cur.is_day === 1 || cur.is_day === true;
  const map = mapWmoToWeatherApi(code, isDay);
  const temp = Number(cur.temperature_2m);

  return {
    location: {
      name: "",
      region: "",
      country: "",
      lat: Number(lat),
      lon: Number(lon),
      tz_id: res.data.timezone || "",
      localtime: cur.time || "",
    },
    current: {
      temp_c: temp,
      temp_c_rounded: Math.round(temp),
      temp_f: (temp * 9) / 5 + 32,
      is_day: isDay ? 1 : 0,
      condition: {
        text: map.text,
        icon: map.icon,
        code: map.code,
      },
      cloud: cur.cloud_cover ?? 0,
      humidity: cur.relative_humidity_2m ?? null,
      wind_kph: cur.wind_speed_10m ?? null,
      // aliases client cũ
      icon: map.icon,
      cloud_cover: (cur.cloud_cover ?? 0) / 100,
      is_daylight: isDay,
      condition_text: map.text,
    },
  };
}

function mapWmoToWeatherApi(code, isDay) {
  const day = isDay ? "day" : "night";
  const icon = (n) => `//cdn.weatherapi.com/weather/64x64/${day}/${n}.png`;
  if (code === 0) return { text: "Clear", code: 1000, icon: icon(113) };
  if (code === 1) return { text: "Mainly clear", code: 1003, icon: icon(116) };
  if (code === 2) return { text: "Partly cloudy", code: 1003, icon: icon(116) };
  if (code === 3) return { text: "Overcast", code: 1009, icon: icon(122) };
  if (code === 45 || code === 48)
    return { text: "Fog", code: 1135, icon: icon(248) };
  if (code >= 51 && code <= 57)
    return { text: "Drizzle", code: 1153, icon: icon(266) };
  if (code >= 61 && code <= 67)
    return { text: "Rain", code: 1183, icon: icon(302) };
  if (code >= 71 && code <= 77)
    return { text: "Snow", code: 1213, icon: icon(326) };
  if (code >= 80 && code <= 82)
    return { text: "Rain showers", code: 1240, icon: icon(353) };
  if (code >= 85 && code <= 86)
    return { text: "Snow showers", code: 1255, icon: icon(368) };
  if (code >= 95)
    return { text: "Thunderstorm", code: 1276, icon: icon(200) };
  return { text: "Clear", code: 1000, icon: icon(113) };
}

/** WeatherAPI.com (cần WEATHER_API_KEY) */
async function fetchWeatherApi(lat, lon) {
  const apiKey = serverConfig.integrations.weatherApiKey;
  if (!apiKey) return null;
  const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}&aqi=no`;
  const response = await axios.get(url, { timeout: 12000 });
  return response.data;
}

const WeatherInfo = async (lat, lon) => {
  try {
    const data = await fetchWeatherApi(lat, lon);
    if (data?.current) return data;
  } catch (error) {
    console.warn(
      "[weather] WeatherAPI fail, fallback Open-Meteo:",
      error?.message || error
    );
  }
  return fetchOpenMeteoAsWeatherApi(lat, lon);
};

const WeatherInfoV2 = async (lat, lon) => {
  try {
    const twilightUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&timezone=auto&forecast_days=1`;

    let weatherData;
    try {
      weatherData = await fetchWeatherApi(lat, lon);
    } catch (e) {
      console.warn("[weather] WeatherAPI V2 fail:", e?.message || e);
      weatherData = null;
    }
    if (!weatherData?.current) {
      weatherData = await fetchOpenMeteoAsWeatherApi(lat, lon);
    }

    const twilightRes = await axios.get(twilightUrl, { timeout: 12000 });
    const twilightData = {
      sunrise: new Date(twilightRes.data.daily.sunrise[0]),
      sunset: new Date(twilightRes.data.daily.sunset[0]),
    };

    return {
      result: transformWeatherToOverlay(weatherData, twilightData),
      raw: weatherData,
    };
  } catch (error) {
    console.error("[weather] WeatherInfoV2:", error?.message || error);
    throw error;
  }
};

const normalizeCondition = (text = "") => {
  const lower = text.toLowerCase();
  if (["sunny", "clear"].some((w) => lower.includes(w))) return "mostlyClear";
  if (["partly cloudy"].some((w) => lower.includes(w))) return "partlyCloudy";
  if (["cloudy", "overcast", "mist"].some((w) => lower.includes(w)))
    return "cloudy";
  if (["fog"].some((w) => lower.includes(w))) return "foggy";
  if (["light rain", "drizzle"].some((w) => lower.includes(w)))
    return "lightRain";
  if (
    ["heavy rain", "moderate rain", "torrential"].some((w) => lower.includes(w))
  )
    return "heavyRain";
  if (["snow"].some((w) => lower.includes(w))) return "snowy";
  if (["sleet"].some((w) => lower.includes(w))) return "sleet";
  if (["ice"].some((w) => lower.includes(w))) return "icy";
  if (["thunder", "storm"].some((w) => lower.includes(w))) return "storm";
  return "unknown";
};

module.exports = { WeatherInfo, WeatherInfoV2, normalizeCondition };
