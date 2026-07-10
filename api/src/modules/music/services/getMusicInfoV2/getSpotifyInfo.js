const axios = require("axios");

const BASE_URL = "https://lynkify.in/isrc-search";

let actions = null;
let token = null;

const client = axios.create({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  },
});

async function discoverActions() {
  if (actions) return actions;

  // console.log("🔍 Discover actions...");

  const html = (await client.get(BASE_URL)).data;

  const match = html.match(
    /\/_next\/static\/chunks\/app\/\(landing\)\/isrc-search\/page-[a-f0-9]+\.js/,
  );

  if (!match) {
    throw new Error("Cannot discover actions");
  }

  const js = (await client.get(`https://lynkify.in${match[0]}`)).data;

  const hashes = [...js.matchAll(/"([a-f0-9]{40})"/g)].map((m) => m[1]);

  actions = {
    getToken: hashes[1],
    search: hashes[2],
    getIsrc: hashes[5],
  };

  // console.log("✅ Actions loaded");

  return actions;
}

async function getSpotifyToken() {
  if (token) return token;

  await discoverActions();

  // console.log("🔑 Getting Spotify token...");

  const res = await client.post(BASE_URL, "[]", {
    headers: {
      "next-action": actions.getToken,
      accept: "text/x-component",
      origin: "https://lynkify.in",
      referer: "https://lynkify.in/isrc-search",
      "content-type": "text/plain;charset=UTF-8",
    },
  });

  const match = String(res.data).match(/\d+:"(.*?)"/);

  if (!match) {
    throw new Error("Cannot get Spotify token");
  }

  token = match[1];

  // console.log("✅ Spotify token received");

  return token;
}

async function getSpotifyInfo(urlOrId) {
  await discoverActions();

  const tk = await getSpotifyToken();

  const trackId = urlOrId.includes("/")
    ? urlOrId.split("/").pop().split("?")[0]
    : urlOrId;

  console.log(`🎵 Track ID: ${trackId}`);

  const res = await client.post(BASE_URL, JSON.stringify([tk, trackId]), {
    headers: {
      "next-action": actions.getIsrc,
      "content-type": "text/plain;charset=UTF-8",
    },
  });

  const match = String(res.data).match(/\d+:(\{.*\})/);

  if (!match) {
    throw new Error("Spotify parse failed");
  }

  const data = JSON.parse(match[1]);
  // console.log(data);

  // console.log(`✅ ${data.name} - ${data.artist}`);

  return {
    artist: data.artist,
    image_url: data.coverImage,
    isrc: data?.isrc,
    song_name: data.name,
    spotify_url: data.spotifyUrl,
  };
}

module.exports = {
  getSpotifyInfo,
  getSpotifyToken,
  discoverActions,
};
