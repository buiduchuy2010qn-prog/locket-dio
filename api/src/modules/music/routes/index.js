const express = require("express");
const { getLimiter } = require("../../../middlewares/rateLimit");
const { logRequestInfo } = require("../../../middlewares/logRequestInfo");
const { verifyIdToken } = require("../../../middlewares/Auth");
const { getInfoTrack, getInfoMusicController, getInfoMusicControllerV2 } = require("../controllers");
const {
  getInfoMusicControllerV3,
  searchMusicController,
} = require("../controllers/music.controller.v2");

const musicRoutes = express.Router();

musicRoutes.post("/spotify", getLimiter, logRequestInfo, verifyIdToken, getInfoTrack);
musicRoutes.post("/spotifyV2", getLimiter, logRequestInfo, verifyIdToken, getInfoTrack);

musicRoutes.post("/getInfoMusic", getInfoMusicController);

musicRoutes.post("/getInfoMusicV3", getInfoMusicControllerV2);
musicRoutes.post("/getInfoMusicV2", getInfoMusicControllerV3);
// Tìm nhạc theo tên — không OAuth user
musicRoutes.post("/searchMusic", getLimiter, logRequestInfo, searchMusicController);
musicRoutes.get("/searchMusic", getLimiter, logRequestInfo, searchMusicController);

module.exports = { musicRoutes };
