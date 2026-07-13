const express = require("express");
const multer = require("multer");
const { getLimiter } = require("../../../middlewares/rateLimit");
const { logRequestInfo } = require("../../../middlewares/logRequestInfo");
const { verifyIdToken } = require("../../../middlewares/Auth");
const {
  getInfoTrack,
  getInfoMusicController,
  getInfoMusicControllerV2,
} = require("../controllers");
const {
  getInfoMusicControllerV3,
  searchMusicController,
} = require("../controllers/music.controller.v2");
const {
  listTracksController,
  searchTracksController,
  uploadTrackController,
  streamAudioController,
  attachMomentMusicController,
  getMomentMusicController,
  deleteMomentMusicController,
} = require("../controllers/musicLibrary.controller");
const { MAX_AUDIO_BYTES } = require("../services/musicLibrary.service");

const musicRoutes = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
});

// ── Legacy Spotify / Apple info ──
musicRoutes.post("/spotify", getLimiter, logRequestInfo, verifyIdToken, getInfoTrack);
musicRoutes.post("/spotifyV2", getLimiter, logRequestInfo, verifyIdToken, getInfoTrack);
musicRoutes.post("/getInfoMusic", getInfoMusicController);
musicRoutes.post("/getInfoMusicV3", getInfoMusicControllerV2);
musicRoutes.post("/getInfoMusicV2", getInfoMusicControllerV3);
musicRoutes.post("/searchMusic", getLimiter, logRequestInfo, searchMusicController);
musicRoutes.get("/searchMusic", getLimiter, logRequestInfo, searchMusicController);

// ── Music library (MusicTrack) ──
musicRoutes.get("/music/tracks", getLimiter, logRequestInfo, listTracksController);
musicRoutes.get("/music/search", getLimiter, logRequestInfo, searchTracksController);
musicRoutes.post(
  "/music/upload",
  getLimiter,
  logRequestInfo,
  verifyIdToken,
  upload.single("file"),
  uploadTrackController,
);
musicRoutes.get("/music/audio/:filename", getLimiter, streamAudioController);

// ── MomentMusic ──
musicRoutes.post(
  "/moments/:id/music",
  getLimiter,
  logRequestInfo,
  verifyIdToken,
  attachMomentMusicController,
);
musicRoutes.get(
  "/moments/:id/music",
  getLimiter,
  logRequestInfo,
  getMomentMusicController,
);
musicRoutes.delete(
  "/moments/:id/music",
  getLimiter,
  logRequestInfo,
  verifyIdToken,
  deleteMomentMusicController,
);

module.exports = { musicRoutes };
