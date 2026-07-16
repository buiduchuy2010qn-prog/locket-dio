import { useState, useEffect, useCallback } from "react";
import {
  getCachedWeather,
  setCachedWeather,
  isCacheNearLocation,
} from "../utils/weatherCache";
import { getInfoWeatherV1, getTwilightInfo } from "@/services";
import { transformWeatherToOverlay } from "../utils/weatherUtils";

const DEFAULT_WEATHER = {
  text: null,
  caption: null,
  icon: {
    color: "#ffca1f",
    data: "sun.max.fill",
    type: "sf_symbol",
  },
  background: {
    colors: ["#4facfe", "#00f2fe"],
  },
  payload: {
    cloud_cover: 0.5,
  },
};

const GEO_OPTS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 60_000,
};

/**
 * Weather for caption pill — always tied to device GPS (current location).
 * Cache: show stale immediately, then re-fetch for this lat/lon.
 */
export function useCurrentWeatherV2() {
  const cached = typeof window !== "undefined" ? getCachedWeather() : null;
  const [weatherInfo, setWeatherInfo] = useState(
    cached?.data || DEFAULT_WEATHER,
  );
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error

  const fetchAt = useCallback(async (latitude, longitude) => {
    setStatus("loading");
    try {
      const [weatherData, twilightData] = await Promise.all([
        getInfoWeatherV1({ lat: latitude, lon: longitude }),
        getTwilightInfo({ lat: latitude, lon: longitude }),
      ]);

      if (!weatherData) {
        setStatus("error");
        return null;
      }

      // Twilight is optional — transform still works with approx sunrise/sunset
      const result = await transformWeatherToOverlay(
        weatherData,
        twilightData || {
          sunrise: new Date(new Date().setHours(6, 0, 0, 0)),
          sunset: new Date(new Date().setHours(18, 0, 0, 0)),
        },
      );

      if (!result?.text) {
        setStatus("error");
        return null;
      }

      // Keep place name if API returned one
      const place =
        weatherData?.location?.name ||
        weatherData?.location?.region ||
        null;
      if (place) {
        result.payload = {
          ...result.payload,
          location_name: place,
          lat: latitude,
          lon: longitude,
        };
      } else {
        result.payload = {
          ...result.payload,
          lat: latitude,
          lon: longitude,
        };
      }

      setWeatherInfo(result);
      setCachedWeather(result, latitude, longitude);
      setStatus("ready");
      return result;
    } catch (e) {
      console.warn("[weather] fetch failed:", e?.message || e);
      setStatus("error");
      return null;
    }
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      return;
    }

    // Stale cache UI only if we will refresh soon
    const existing = getCachedWeather();
    if (existing?.data?.text) {
      setWeatherInfo(existing.data);
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const near = isCacheNearLocation(existing, latitude, longitude);

        // Fresh + same place → keep cache, skip network
        if (near && existing?.data?.text) {
          setWeatherInfo(existing.data);
          setStatus("ready");
          // Still soft-refresh in background every time studio mounts
          fetchAt(latitude, longitude);
          return;
        }

        await fetchAt(latitude, longitude);
      },
      (err) => {
        console.warn("[weather] geolocation:", err?.message || err);
        // Keep cache if any
        if (existing?.data?.text) {
          setWeatherInfo(existing.data);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      },
      GEO_OPTS,
    );
  }, [fetchAt]);

  return weatherInfo;
}
