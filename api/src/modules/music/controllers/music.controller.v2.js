const {
  logInfo,
  logError,
  logSuccess,
} = require("../../../utils/logEventUtils");
const { fetchMusicApi } = require("../services/fetchMusicApi");
const {
  getAppleMusicMeta,
  getSpotifyTrackInfo,
} = require("../services/getMusicInfoV1");
const {
  getAppleMusicInfo,
  getSpotifyInfo,
} = require("../services/getMusicInfoV2");

const getInfoMusicControllerV2 = async (req, res, next) => {
  const { url, platform } = req.body;

  try {
    logInfo("getInfoMusic", `🎵 Đang lấy thông tin bài hát từ ${platform}...`);

    let data = null;

    if (platform === "apple") {
      const meta = await getAppleMusicMeta(url);
      const info = await getAppleMusicInfo(url);

      data = {
        artist: meta.artist || info.artist,
        image_url: meta.image || info.image,

        isrc: info.isrc,

        preview_url: meta.previewUrl,
        song_name: meta.name || meta.name,
        apple_music_url: meta.appleMusicUrl || info.appleLink,

        title: meta.title,
        song_title: meta.name,
        album: meta.album,
        platform: "apple",
      };
    } else if (platform === "spotify") {
      const meta = await getSpotifyTrackInfo(url);
      const info = await getSpotifyInfo(url);

      data = {
        artist: meta.artist || info.artist,
        image_url: meta.image,

        isrc: info.isrc,

        preview_url: meta.previewUrl,
        song_name: meta.name || info.name,
        spotify_url: meta.spotify_url || info.spotifyLink,

        title: meta.title,
        song_title: meta.name,
        album: meta?.album,
        platform: "spotify",
      };
    } else {
      return res.status(400).json({
        status: "error",
        message: "Nền tảng không được hỗ trợ! (apple | spotify)",
      });
    }

    if (!data) {
      logError("getInfoMusic", "❌ Không tìm thấy thông tin bài hát!");
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy thông tin bài hát!",
      });
    }

    logSuccess("getInfoMusic", "✅ Lấy thông tin bài hát thành công!");

    return res.status(200).json({
      status: "success",
      message: "ok",
      data,
    });
  } catch (error) {
    logError("getInfoMusic", "❌ Lỗi khi lấy thông tin bài hát", error.message);
    next(error);
  }
};

const getInfoMusicControllerV3 = async (req, res, next) => {
  const { url, platform } = req.body;

  try {
    logInfo("getInfoMusic", `🎵 Đang lấy thông tin bài hát từ ${platform}...`);


    const info = await fetchMusicApi(url, platform);

    if (!info) {
      logError("getInfoMusic", "❌ Không tìm thấy thông tin bài hát!");
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy thông tin bài hát!",
      });
    }

    logSuccess("getInfoMusic", "✅ Lấy thông tin bài hát thành công!");
    
    return res.status(200).json({
      status: "success",
      message: "ok",
      data: info,
    });
  } catch (error) {
    logError("getInfoMusic", "❌ Lỗi khi lấy thông tin bài hát", error.message);
    next(error);
  }
};

module.exports = {
  getInfoMusicControllerV2,
  getInfoMusicControllerV3,
};
