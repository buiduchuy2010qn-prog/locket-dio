const axios = require("axios");
const cheerio = require('cheerio');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

async function getSpotifyAccessToken() {
  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    new URLSearchParams({ grant_type: "client_credentials" }),
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data.access_token;
}

async function getTrackInfoFromSpotify(spotifyUrl) {
  const trackId = extractTrackId(spotifyUrl);
  if (!trackId) return null;

  const token = await getSpotifyAccessToken();

  const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  //Lấy link nghe trước
  const previewUrls = await getSpotifyLinks(spotifyUrl);
  const data = response.data;
  // console.log(data);
  return {
    title: data.name,
    artist: data.artists.map((a) => a.name).join(", "),
    album: data.album.name,
    preview_url: previewUrls,
    spotify_url: data.external_urls.spotify,
    image: data.album.images?.[0]?.url,
    isrc: data.external_ids.isrc,
  };
}
async function getSpotifyLinks(url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const scdnLinks = new Set();

    $('*').each((i, element) => {
      const attrs = element.attribs;
      Object.values(attrs).forEach(value => {
        if (value && value.includes('p.scdn.co')) {
          scdnLinks.add(value);
        }
      });
    });

    return Array.from(scdnLinks);
  } catch (error) {
    throw new Error(`Failed to fetch preview URLs: ${error.message}`);
  }
}
function extractTrackId(url) {
  try {
    const match = url.match(/track\/([a-zA-Z0-9]+)(\?|$)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

module.exports = {
  getTrackInfoFromSpotify,
};
