const axios = require("axios");
const { searchSpotifyByName } = require("./searchSpotifyByName");

async function getAppleMusicInfo(url) {
  // console.log("\n🍎 ===== Apple Music Info =====");
  // console.log("URL:", url);

  let appleId = null;

  let match = url.match(/[?&]i=(\d+)/);

  if (match) appleId = match[1];

  if (!appleId) {
    match = url.match(/\/song\/.*\/(\d+)/);

    if (match) appleId = match[1];
  }

  if (!appleId) {
    match = url.match(/\/album\/.*\/(\d+)/);

    if (match) appleId = match[1];
  }

  if (!appleId) {
    throw new Error("Invalid Apple Music URL");
  }

  // console.log("🎵 Apple ID:", appleId);
  // console.log("📡 Lookup iTunes...");

  const { data } = await axios.get(
    `https://itunes.apple.com/lookup?id=${appleId}&country=VN`
  );

  if (!data.resultCount) {
    throw new Error("Track not found");
  }

  const track = data.results[0];

  // console.log(`✅ ${track.trackName} - ${track.artistName}`);

  const result = {
    name: track.trackName,
    artist: track.artistName,
    album: track.collectionName,
    appleLink: track.trackViewUrl,
    isrc: track.isrc || null,
    source: "Apple Music",
  };

  if (result.isrc) {
    // console.log("✅ ISRC từ Apple:", result.isrc);
  } else {
    // console.log("⚠️ Apple không có ISRC, tìm trên Spotify...");

    try {
      const sp = await searchSpotifyByName(
        result.name,
        result.artist
      );

      if (sp) {
        result.isrc = sp.isrc;
        result.spotifyLink = sp.spotifyLink;
        result.source = "Apple + Spotify";

        // console.log("✅ ISRC từ Spotify:", sp.isrc);
      } else {
        // console.log("❌ Không tìm thấy ISRC trên Spotify");
      }
    } catch (err) {
      // console.log("❌ Lỗi khi tìm ISRC trên Spotify:", err.message);
    }
  }

  // console.log("🎉 Hoàn tất lấy thông tin Apple Music");

  return result;
}

module.exports = {
  getAppleMusicInfo,
};