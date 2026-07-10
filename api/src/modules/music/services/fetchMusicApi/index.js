const axios = require("axios");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const http = axios.create({
  timeout: 15000,
  headers: { "User-Agent": UA, Accept: "application/json,text/html,*/*" },
  validateStatus: (s) => s >= 200 && s < 500,
});

function extractSpotifyTrackId(url = "") {
  const m = String(url).match(
    /(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/|spotify:track:)([a-zA-Z0-9]+)/i,
  );
  return m ? m[1] : null;
}

function extractAppleId(url = "") {
  let m = String(url).match(/[?&]i=(\d+)/);
  if (m) return m[1];
  m = String(url).match(/\/song\/[^/]+\/(\d+)/);
  if (m) return m[1];
  m = String(url).match(/\/album\/[^/]+\/(\d+)/);
  if (m) return m[1];
  return null;
}

function buildTitle(name, artist) {
  return [name, artist].filter(Boolean).join(" - ");
}

function normalizeSpotifyUrl(url, trackId) {
  if (trackId) return `https://open.spotify.com/track/${trackId}`;
  return String(url || "").split("?")[0];
}

/** Official Spotify Web API (needs SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET). */
async function fetchSpotifyOfficial(trackId) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret || !trackId) return null;

  try {
    const tokenRes = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }),
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 12000,
      },
    );
    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) return null;

    const tr = await axios.get(
      `https://api.spotify.com/v1/tracks/${trackId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 12000,
      },
    );
    const d = tr.data;
    if (!d?.name) return null;

    return {
      song_name: d.name,
      artist: (d.artists || []).map((a) => a.name).join(", "),
      album: d.album?.name || "",
      image_url: d.album?.images?.[0]?.url || "",
      preview_url: d.preview_url || null,
      isrc: d.external_ids?.isrc || null,
      spotify_url: d.external_urls?.spotify || normalizeSpotifyUrl("", trackId),
      source: "spotify-api",
    };
  } catch (e) {
    console.warn("fetchSpotifyOfficial:", e.message);
    return null;
  }
}

/** Spotify oEmbed — title + thumbnail for valid public tracks. */
async function fetchSpotifyOembed(url) {
  try {
    const r = await http.get("https://open.spotify.com/oembed", {
      params: { url },
    });
    if (r.status !== 200 || !r.data?.title) return null;
    return {
      song_name: r.data.title,
      artist: "",
      image_url: r.data.thumbnail_url || "",
      source: "spotify-oembed",
    };
  } catch (e) {
    console.warn("fetchSpotifyOembed:", e.message);
    return null;
  }
}

/**
 * song.link / odesli — title, artist, artwork across platforms.
 * Also used to grab Deezer preview when available.
 */
async function fetchSongLink(url) {
  for (const base of [
    "https://api.song.link/v1-alpha.1/links",
    "https://api.odesli.co/v1-alpha.1/links",
  ]) {
    try {
      const r = await http.get(base, {
        params: { url, userCountry: "US" },
        timeout: 18000,
      });
      if (r.status !== 200 || !r.data?.entitiesByUniqueId) continue;

      const entities = r.data.entitiesByUniqueId;
      const byProvider = {};
      for (const ent of Object.values(entities)) {
        if (ent?.apiProvider) byProvider[ent.apiProvider] = ent;
      }

      const spotify =
        byProvider.spotify ||
        Object.values(entities).find((e) =>
          (e.platforms || []).includes("spotify"),
        );
      const deezer = byProvider.deezer;
      const apple = byProvider.appleMusic || byProvider.itunes;

      let preview_url = null;
      if (deezer?.id) {
        try {
          const dz = await http.get(`https://api.deezer.com/track/${deezer.id}`, {
            timeout: 10000,
          });
          if (dz.status === 200 && dz.data?.preview) {
            preview_url = dz.data.preview;
          }
        } catch {
          /* optional */
        }
      }

      const primary = spotify || apple || deezer || Object.values(entities)[0];
      if (!primary?.title) continue;

      return {
        song_name: primary.title,
        artist: primary.artistName || "",
        image_url: primary.thumbnailUrl || "",
        preview_url,
        isrc: null,
        apple_music_url: r.data.linksByPlatform?.appleMusic?.url || null,
        spotify_url: r.data.linksByPlatform?.spotify?.url || null,
        source: "songlink",
      };
    } catch (e) {
      console.warn("fetchSongLink:", base, e.message);
    }
  }
  return null;
}

/** iTunes Lookup for Apple Music links. */
async function fetchAppleItunes(url) {
  const appleId = extractAppleId(url);
  if (!appleId) return null;

  try {
    const { data } = await http.get("https://itunes.apple.com/lookup", {
      params: { id: appleId, country: "VN" },
      timeout: 12000,
    });
    const track = data?.results?.[0];
    if (!track) return null;

    return {
      song_name: track.trackName || track.collectionName,
      artist: track.artistName || "",
      album: track.collectionName || "",
      image_url: (track.artworkUrl100 || "").replace("100x100", "600x600"),
      preview_url: track.previewUrl || null,
      isrc: track.isrc || null,
      apple_music_url: track.trackViewUrl || url,
      source: "itunes",
    };
  } catch (e) {
    console.warn("fetchAppleItunes:", e.message);
    return null;
  }
}

function toClientShape(partial, platform, originalUrl) {
  if (!partial?.song_name && !partial?.title) return null;

  const song_name = partial.song_name || partial.name || partial.title || "";
  const artist = partial.artist || "";
  const title = buildTitle(song_name, artist);
  const image_url =
    partial.image_url || partial.image || partial.thumbnail_url || "";

  const data = {
    artist,
    image_url,
    isrc: partial.isrc || null,
    preview_url: partial.preview_url || partial.previewUrl || null,
    song_name,
    song_title: song_name,
    name: song_name,
    title,
    album: partial.album || "",
    platform,
    source: partial.source || "local",
  };

  if (platform === "spotify") {
    data.spotify_url =
      partial.spotify_url ||
      normalizeSpotifyUrl(originalUrl, extractSpotifyTrackId(originalUrl));
  } else {
    data.apple_music_url = partial.apple_music_url || originalUrl;
    if (partial.spotify_url) data.spotify_url = partial.spotify_url;
  }

  return data;
}

async function getSpotifyMusicInfo(url) {
  const trackId = extractSpotifyTrackId(url);
  if (!trackId) {
    const err = new Error(
      "URL Spotify không hợp lệ. Cần link dạng open.spotify.com/track/...",
    );
    err.status = 400;
    throw err;
  }

  const cleanUrl = normalizeSpotifyUrl(url, trackId);

  // Parallel free sources first (fast), official API if configured
  const [official, oembed, songlink] = await Promise.all([
    fetchSpotifyOfficial(trackId),
    fetchSpotifyOembed(cleanUrl),
    fetchSongLink(cleanUrl),
  ]);

  // Prefer richest data: official > songlink (has artist) > oembed
  const merged = {
    song_name:
      official?.song_name || songlink?.song_name || oembed?.song_name || "",
    artist: official?.artist || songlink?.artist || oembed?.artist || "",
    album: official?.album || songlink?.album || "",
    image_url:
      official?.image_url || songlink?.image_url || oembed?.image_url || "",
    preview_url:
      official?.preview_url || songlink?.preview_url || null,
    isrc: official?.isrc || songlink?.isrc || null,
    spotify_url:
      official?.spotify_url || songlink?.spotify_url || cleanUrl,
    source:
      official?.source ||
      songlink?.source ||
      oembed?.source ||
      "none",
  };

  if (!merged.song_name) {
    const err = new Error(
      "Không tìm thấy bài hát trên Spotify (link có thể đã gỡ hoặc không công khai).",
    );
    err.status = 404;
    throw err;
  }

  return toClientShape(merged, "spotify", cleanUrl);
}

async function getAppleMusicInfoLocal(url) {
  const [itunes, songlink] = await Promise.all([
    fetchAppleItunes(url),
    fetchSongLink(url).catch(() => null),
  ]);

  const merged = {
    song_name: itunes?.song_name || songlink?.song_name || "",
    artist: itunes?.artist || songlink?.artist || "",
    album: itunes?.album || "",
    image_url: itunes?.image_url || songlink?.image_url || "",
    preview_url: itunes?.preview_url || songlink?.preview_url || null,
    isrc: itunes?.isrc || null,
    apple_music_url: itunes?.apple_music_url || url,
    spotify_url: songlink?.spotify_url || null,
    source: itunes?.source || songlink?.source || "none",
  };

  if (!merged.song_name) {
    const err = new Error(
      "Không tìm thấy bài hát trên Apple Music (link không hợp lệ hoặc không hỗ trợ).",
    );
    err.status = 404;
    throw err;
  }

  return toClientShape(merged, "apple", url);
}

/**
 * Local reliable music fetch — no dependency on api-beta.locket-dio.com.
 */
const fetchMusicApi = async (url, platform = "spotify") => {
  if (!url) {
    const err = new Error("Thiếu URL bài hát");
    err.status = 400;
    throw err;
  }

  const p = String(platform || "spotify").toLowerCase();

  if (p === "spotify") {
    return getSpotifyMusicInfo(url);
  }
  if (p === "apple" || p === "apple_music" || p === "apple-music") {
    return getAppleMusicInfoLocal(url);
  }

  const err = new Error("Nền tảng không được hỗ trợ! (apple | spotify)");
  err.status = 400;
  throw err;
};

module.exports = {
  fetchMusicApi,
  getSpotifyMusicInfo,
  getAppleMusicInfoLocal,
  extractSpotifyTrackId,
};
