import { instanceMain } from "@/lib/axios.main";

/**
 * Gọi API thời tiết Dio.
 * Trả về object `{ current, location }` hoặc null — KHÔNG bọc axios response.
 */
export const getInfoWeather = async ({ lat, lon }) => {
  if (lat == null || lon == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lon))) {
    console.warn("⚠️ getInfoWeather: thiếu lat/lon");
    return null;
  }

  try {
    const res = await instanceMain.post("/api/weatherV2", {
      lat: Number(lat),
      lon: Number(lon),
    });

    const body = res?.data;
    if (body?.status === "success" && body?.data) {
      return body.data; // { current, location }
    }

    // Một số proxy trả thẳng data
    if (body?.current) return body;
    if (body?.data?.current) return body.data;

    console.error("❌ getInfoWeather: response không hợp lệ", body);
    return null;
  } catch (error) {
    console.error("🚨 getInfoWeather:", error?.message || error);
    return null;
  }
};
