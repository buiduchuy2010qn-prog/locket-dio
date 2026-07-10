const { logInfo, logError, logSuccess } = require("../../../utils/logEventUtils");
const { WeatherInfoV2, WeatherInfo } = require("../services");

const getInfoWeather = async (req, res, next) => {
  const { lat, lon } = req.body;
  if (!lat || !lon) {
    return res.status(400).json({ error: "Thiếu toạ độ lat hoặc lon" });
  }
  try {
    logInfo("GetInfoWeather", "Đang lấy thông tin thời tiết...");

    logInfo("GetInfoWeather",` Location coordinates: lat=${lat}, lon=${lon}`);

    const response = await WeatherInfoV2(lat, lon);

    if (!response) {
      logError("GetInfoWeather", "❌ Không tìm thấy thông tin thời tiết!");
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin thời tiết!" });
    }

    logSuccess("GetInfoWeather", "✅ Lấy thông tin thời tiết thành công!");
    res.status(200).json({
      status: "success",
      message: "ok",
      data: response?.result,
    });
  } catch (error) {
    logError(
      "GetInfoWeather",
      "❌ Lỗi khi lấy thông tin thời tiết",
      error.message
    );
    next(error);
  }
};

const getInfoWeatherV2 = async (req, res, next) => {
  const { lat, lon } = req.body;
  if (!lat || !lon) {
    return res.status(400).json({ error: "Thiếu toạ độ lat hoặc lon" });
  }
  try {
    logInfo("GetInfoWeather", "Đang lấy thông tin thời tiết...");

    logInfo("GetInfoWeather",` Location coordinates: lat=${lat}, lon=${lon}`);

    const response = await WeatherInfo(lat, lon);

    if (!response) {
      logError("GetInfoWeather", "❌ Không tìm thấy thông tin thời tiết!");
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin thời tiết!" });
    }

    logSuccess("GetInfoWeather", "✅ Lấy thông tin thời tiết thành công!");
    res.status(200).json({
      status: "success",
      message: "ok!",
      data: response,
    });
  } catch (error) {
    logError(
      "GetInfoWeather",
      "❌ Lỗi khi lấy thông tin thời tiết",
      error.message
    );
    next(error);
  }
};

module.exports = {
  getInfoWeather,
  getInfoWeatherV2
};
