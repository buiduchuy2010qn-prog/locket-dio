const {
  logInfo,
  logError,
  logSuccess,
} = require("../../../utils/logEventUtils");
const {
  fetchMusicApi,
  searchMusicByQuery,
} = require("../services/fetchMusicApi");
const {
  getAppleMusicMeta,
  getSpotifyTrackInfo,
} = require("../services/getMusicInfoV1");
const {
  getAppleMusicInfo,
  getSpotifyInfo,
} = require("../services/getMusicInfoV2");

/**
 * V2 (legacy scrapers): keep for /getInfoMusicV3 callers that still want scrape path.
 */
const getInfoMusicControllerV2 = async (req, res, next) => {
  const { url, platform } = req.body;

  try {
    logInfo("getInfoMusic", `🎵 [V2 scrape] Lấy info từ ${platform}...`);

    // Prefer reliable local path first; fall back to old scrapers
    try {
      const data = await fetchMusicApi(url, platform);
      if (data) {
        logSuccess("getInfoMusic", "✅ Lấy info thành công (local reliable)");
        return res.status(200).json({
          status: "success",
          message: "ok",
          data,
        });
      }
    } catch (localErr) {
      logInfo(
        "getInfoMusic",
        `Local reliable failed, try scrapers: ${localErr.message}`,
      );
    }

    let data = null;

    if (platform === "apple") {
      const meta = (await getAppleMusicMeta(url).catch(() => null)) || {};
      const info = (await getAppleMusicInfo(url).catch(() => null)) || {};

      data = {
        artist: meta.artist || info.artist,
        image_url: meta.image || info.image,
        isrc: info.isrc,
        preview_url: meta.previewUrl,
        song_name: meta.name || info.name,
        apple_music_url: meta.appleMusicUrl || info.appleLink,
        title: meta.title || [meta.name || info.name, meta.artist || info.artist].filter(Boolean).join(" - "),
        song_title: meta.name || info.name,
        album: meta.album,
        platform: "apple",
      };
    } else if (platform === "spotify") {
      const meta = (await getSpotifyTrackInfo(url).catch(() => null)) || {};
      const info = (await getSpotifyInfo(url).catch(() => null)) || {};

      data = {
        artist: meta.artist || info.artist,
        image_url: meta.image || info.image_url,
        isrc: info.isrc,
        preview_url: meta.previewUrl || meta.preview_url,
        song_name: meta.name || info.song_name || info.name,
        spotify_url: meta.spotify_url || info.spotify_url || info.spotifyLink || url,
        title:
          meta.title ||
          [meta.name || info.song_name, meta.artist || info.artist]
            .filter(Boolean)
            .join(" - "),
        song_title: meta.name || info.song_name,
        album: meta?.album,
        platform: "spotify",
      };

      if (!data.song_name && !data.title) data = null;
    } else {
      return res.status(400).json({
        status: "error",
        message: "Nền tảng không được hỗ trợ! (apple | spotify)",
      });
    }

    if (!data || (!data.song_name && !data.title)) {
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
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({
        status: "error",
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * V3 used by client route POST /api/getInfoMusicV2.
 * Uses local reliable providers (oEmbed + song.link + optional Spotify API).
 * Does NOT depend on api-beta.locket-dio.com.
 */
const getInfoMusicControllerV3 = async (req, res, next) => {
  const { url, platform } = req.body;

  try {
    if (!url || !platform) {
      return res.status(400).json({
        status: "error",
        message: "Thiếu url hoặc platform",
      });
    }

    logInfo(
      "getInfoMusic",
      `🎵 [V2 route/local] Lấy info từ ${platform}: ${String(url).slice(0, 80)}`,
    );

    const info = await fetchMusicApi(url, platform);

    if (!info) {
      logError("getInfoMusic", "❌ Không tìm thấy thông tin bài hát!");
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy thông tin bài hát!",
      });
    }

    logSuccess(
      "getInfoMusic",
      `✅ Lấy info OK: ${info.title} (${info.source || "local"})`,
    );

    return res.status(200).json({
      status: "success",
      message: "ok",
      data: info,
    });
  } catch (error) {
    logError("getInfoMusic", "❌ Lỗi khi lấy thông tin bài hát", error.message);
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({
        status: "error",
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Tìm nhạc theo tên (không cần liên kết Spotify user).
 * POST /api/searchMusic { query, limit? }
 */
const searchMusicController = async (req, res, next) => {
  try {
    const query = req.body?.query || req.body?.q || req.query?.q;
    const limit = req.body?.limit || req.query?.limit || 40;
    if (!query || !String(query).trim()) {
      return res.status(400).json({
        status: "error",
        message: "Thiếu từ khóa tìm kiếm",
      });
    }
    logInfo("searchMusic", `🔍 Search: ${String(query).slice(0, 80)}`);
    const list = await searchMusicByQuery(query, limit);
    logSuccess("searchMusic", `✅ ${list.length} kết quả`);
    return res.status(200).json({
      status: "success",
      message: "ok",
      data: list,
    });
  } catch (error) {
    logError("searchMusic", error.message);
    if (error.status === 400) {
      return res.status(400).json({ status: "error", message: error.message });
    }
    next(error);
  }
};

module.exports = {
  getInfoMusicControllerV2,
  getInfoMusicControllerV3,
  searchMusicController,
};
