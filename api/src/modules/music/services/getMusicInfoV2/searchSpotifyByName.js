const axios = require("axios");
const {
  getSpotifyInfo,
  getSpotifyToken,
  discoverActions,
} = require("./getSpotifyInfo");

const BASE_URL = "https://lynkify.in/isrc-search";

async function searchSpotifyByName(track, artist) {
  console.log(`🔍 Search Spotify: ${track} - ${artist}`);

  const actions = await discoverActions();
  const token = await getSpotifyToken();

  const cleanName = track
    .replace(/\(feat\..*?\)/gi, "")
    .trim();

  const query = `${cleanName} ${artist}`;

  console.log("📝 Query:", query);

  const res = await axios.post(
    BASE_URL,
    JSON.stringify([token, query]),
    {
      headers: {
        "next-action": actions.search,
        "content-type": "text/plain;charset=UTF-8",
      },
    }
  );

  const ids = [
    ...String(res.data).matchAll(/"id":"([A-Za-z0-9]{22})"/g),
  ].map((m) => m[1]);

  if (!ids.length) {
    console.log("❌ Không tìm thấy trên Spotify");
    return null;
  }

  console.log("✅ Spotify Track ID:", ids[0]);

  return getSpotifyInfo(ids[0]);
}

module.exports = {
  searchSpotifyByName,
};