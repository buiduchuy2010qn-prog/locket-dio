const { getSpotifyTrackInfo, getAppleMusicMeta } = require("../services/getMusicInfoV1");
const { logInfo, logError, logSuccess } = require("../../../utils/logEventUtils");

const getInfoTrack = async (req, res, next) => {
  const { spotifyUrl } = req.body;
  try {
    logInfo("spotify", "🎵 Đang lấy thông tin bài hát từ Spotify...");
    const response = await getSpotifyTrackInfo(spotifyUrl);
    if (!response) {
      logError("spotify", "❌ Không tìm thấy thông tin bài hát!");
      return res.status(404).json({ message: "Không tìm thấy thông tin bài hát!" });
    }
    logSuccess("spotify 🎵", "✅ Lấy thông tin bài hát thành công!");
    res.status(200).json({ status: "success", message: "Lấy thông tin bài hát thành công!", data: response });
  } catch (error) {
    logError("spotify", "❌ Lỗi khi lấy thông tin bài hát", error.message);
    next(error);
  }
};

const getInfoMusicController = async (req, res, next) => {
  const { url, platform } = req.body;
  try {
    logInfo("getInfoMusic", `🎵 Đang lấy thông tin bài hát từ ${platform}...`);
    let response = null;
    if (platform === "apple") {
      response = await getAppleMusicMeta(url);
    } else if (platform === "spotify") {
      response = await getSpotifyTrackInfo(url);
    } else {
      return res.status(400).json({ status: "error", message: "Nền tảng không được hỗ trợ! (apple | spotify)" });
    }
    if (!response) {
      logError("getInfoMusic", "❌ Không tìm thấy thông tin bài hát!");
      return res.status(404).json({ status: "error", message: "Không tìm thấy thông tin bài hát!" });
    }
    response.platform = platform;
    logSuccess("getInfoMusic", "✅ Lấy thông tin bài hát thành công!");
    res.status(200).json({ status: "success", message: "Author by Dio", data: response });
  } catch (error) {
    logError("getInfoMusic", "❌ Lỗi khi lấy thông tin bài hát", error.message);
    next(error);
  }
};

module.exports = {
  getInfoTrack,
  getInfoMusicController,
};
