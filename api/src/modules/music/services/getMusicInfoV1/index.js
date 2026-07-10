const { getAppleMusicMeta } = require("./apple-music.service");
const { getSpotifyTrackInfo } = require("./spotify.service");

module.exports = {
  getAppleMusicMeta,
  getSpotifyTrackInfo,
};
