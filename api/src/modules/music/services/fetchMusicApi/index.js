/**
 * Music metadata for Locket music caption.
 * Locket app thật cần: isrc + song_title + artist + (spotify_url|apple_music_url)
 * + preview_url ổn định để web phát được.
 */
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

/** Cache client-credentials token (Spotify Web API official) */
let spotifyAppToken = null;
let spotifyAppTokenExp = 0;

async function getSpotifyAppToken() {
  // Ưu tiên env Render; fallback app "huy locket" (client credentials)
  const clientId =
    process.env.SPOTIFY_CLIENT_ID ||
    process.env.VITE_SPOTIFY_CLIENT_ID ||
    "1f89199367264178a0b8c66d7e74c1d6";
  const clientSecret =
    process.env.SPOTIFY_CLIENT_SECRET ||
    "e600849643f94f8b9eb5ca247e1febf8";
  if (!clientId || !clientSecret) return null;
  if (spotifyAppToken && Date.now() < spotifyAppTokenExp) {
    return spotifyAppToken;
  }
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
        timeout: 10000,
      },
    );
    const accessToken = tokenRes.data?.access_token;
    const expiresIn = Number(tokenRes.data?.expires_in) || 3600;
    if (!accessToken) return null;
    spotifyAppToken = accessToken;
    spotifyAppTokenExp = Date.now() + (expiresIn - 60) * 1000;
    return accessToken;
  } catch (e) {
    console.warn("getSpotifyAppToken:", e.message);
    return null;
  }
}

/**
 * Spotify Web API official (full meta + isrc + preview nếu có).
 * Cần SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET trên API server.
 */
async function fetchSpotifyOfficial(trackId) {
  if (!trackId) return null;
  try {
    const accessToken = await getSpotifyAppToken();
    if (!accessToken) return null;

    const tr = await axios.get(
      `https://api.spotify.com/v1/tracks/${trackId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      },
    );
    const d = tr.data;
    if (!d?.name) return null;

    return {
      song_name: d.name,
      artist: (d.artists || []).map((a) => a.name).join(", "),
      album: d.album?.name || "",
      image_url: d.album?.images?.[0]?.url || d.album?.images?.[1]?.url || "",
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

/**
 * oEmbed — siêu nhanh: title + cover (không preview/ISRC).
 * Ưu tiên cho meta tức thì khi dán link track.
 */
async function fetchSpotifyOembed(url) {
  try {
    const r = await http.get("https://open.spotify.com/oembed", {
      params: { url },
      timeout: 6000,
    });
    if (r.status !== 200 || !r.data?.title) return null;
    // title oEmbed đôi khi "Song · Artist" hoặc chỉ tên bài
    let song_name = r.data.title || "";
    let artist = "";
    if (song_name.includes(" · ")) {
      const parts = song_name.split(" · ");
      song_name = parts[0].trim();
      artist = (parts[1] || "").trim();
    }
    return {
      song_name,
      artist,
      image_url: r.data.thumbnail_url || "",
      source: "spotify-oembed",
    };
  } catch (e) {
    console.warn("fetchSpotifyOembed:", e.message);
    return null;
  }
}

/** Deezer track → isrc + preview (quan trọng cho Locket). Luôn GET /track/{id} vì search đôi khi thiếu isrc. */
async function enrichFromDeezer(deezerId, songName, artist) {
  try {
    let trackId = deezerId ? String(deezerId).replace(/^deezer:track:/i, "") : null;

    if (!trackId && songName) {
      const q = [songName, artist].filter(Boolean).join(" ");
      const s = await http.get("https://api.deezer.com/search", {
        params: { q, limit: 8 },
        timeout: 12000,
      });
      const hits = s.data?.data || [];
      const nameL = songName.toLowerCase();
      const artistL = (artist || "").toLowerCase();
      const best =
        hits.find(
          (t) =>
            t.title?.toLowerCase() === nameL &&
            (!artistL || t.artist?.name?.toLowerCase().includes(artistL.slice(0, 8))),
        ) ||
        hits.find(
          (t) =>
            t.title?.toLowerCase() === nameL ||
            t.title?.toLowerCase().includes(nameL.slice(0, 12)),
        ) ||
        hits[0];
      trackId = best?.id ? String(best.id) : null;
    }

    if (!trackId) return null;

    const r = await http.get(`https://api.deezer.com/track/${trackId}`, {
      timeout: 12000,
    });
    const track = r.status === 200 && r.data?.id ? r.data : null;
    if (!track) return null;

    return {
      isrc: track.isrc || null,
      // Deezer preview signed — chỉ dùng tạm; iTunes sẽ ghi đè
      preview_url: track.preview || null,
      song_name: track.title || songName,
      artist: track.artist?.name || artist,
      image_url: track.album?.cover_xl || track.album?.cover_big || null,
      album: track.album?.title || "",
      source: "deezer",
    };
  } catch (e) {
    console.warn("enrichFromDeezer:", e.message);
    return null;
  }
}

/** iTunes — preview .m4a ổn định (web play được) */
async function enrichFromItunes(songName, artist) {
  if (!songName) return null;
  try {
    const term = [songName, artist].filter(Boolean).join(" ");
    const r = await http.get("https://itunes.apple.com/search", {
      params: {
        term,
        entity: "song",
        limit: 5,
        country: "US",
      },
      timeout: 12000,
    });
    const hits = r.data?.results || [];
    if (!hits.length) return null;

    const nameL = songName.toLowerCase();
    const artistL = (artist || "").toLowerCase();
    const best =
      hits.find(
        (t) =>
          t.trackName?.toLowerCase() === nameL ||
          (t.trackName?.toLowerCase().includes(nameL.slice(0, 10)) &&
            (!artistL || t.artistName?.toLowerCase().includes(artistL.slice(0, 8)))),
      ) || hits[0];

    // lookup for isrc
    let isrc = best.isrc || null;
    if (best.trackId) {
      try {
        const lk = await http.get("https://itunes.apple.com/lookup", {
          params: { id: best.trackId, country: "US" },
          timeout: 8000,
        });
        isrc = lk.data?.results?.[0]?.isrc || isrc;
      } catch {
        /* optional */
      }
    }

    return {
      song_name: best.trackName || songName,
      artist: best.artistName || artist,
      album: best.collectionName || "",
      image_url: (best.artworkUrl100 || "").replace("100x100", "600x600"),
      preview_url: best.previewUrl || null,
      isrc,
      apple_music_url: best.trackViewUrl || null,
      source: "itunes-search",
    };
  } catch (e) {
    console.warn("enrichFromItunes:", e.message);
    return null;
  }
}

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
      const primary = spotify || apple || deezer || Object.values(entities)[0];
      if (!primary?.title) continue;

      return {
        song_name: primary.title,
        artist: primary.artistName || "",
        image_url: primary.thumbnailUrl || "",
        deezerId: deezer?.id || null,
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

async function fetchAppleItunes(url) {
  const appleId = extractAppleId(url);
  if (!appleId) return null;

  try {
    const { data } = await http.get("https://itunes.apple.com/lookup", {
      params: { id: appleId, country: "US" },
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

function isEphemeralPreview(url = "") {
  const u = String(url || "");
  if (!u) return true;
  if (/dzcdn\.net|hdnea=/i.test(u)) return true;
  if (/p\.scdn\.co/i.test(u)) return true;
  return false;
}

/**
 * Gộp metadata + bắt buộc cố gắng lấy isrc + preview ổn định.
 * Chạy Deezer + iTunes song song để giảm timeout cold-start Render.
 */
async function enrichMusicMeta(base) {
  let song_name = base.song_name || "";
  let artist = base.artist || "";
  let album = base.album || "";
  let image_url = base.image_url || "";
  let preview_url = base.preview_url || null;
  let isrc = base.isrc || null;
  let apple_music_url = base.apple_music_url || null;
  let spotify_url = base.spotify_url || null;
  let source = base.source || "local";

  const needIsrc = !isrc;
  const needPreview = !preview_url || isEphemeralPreview(preview_url);

  const [dz, it] = await Promise.all([
    needIsrc || needPreview
      ? enrichFromDeezer(base.deezerId, song_name, artist)
      : Promise.resolve(null),
    song_name ? enrichFromItunes(song_name, artist) : Promise.resolve(null),
  ]);

  if (dz) {
    isrc = isrc || dz.isrc;
    // Chỉ dùng Deezer preview nếu chưa có gì (sẽ bị iTunes ghi đè nếu có)
    if (!preview_url && dz.preview_url) preview_url = dz.preview_url;
    if (!image_url && dz.image_url) image_url = dz.image_url;
    if (!artist && dz.artist) artist = dz.artist;
    if (!album && dz.album) album = dz.album;
    if (dz.isrc) source = `${source}+deezer`;
  }

  if (it) {
    // Ưu tiên iTunes preview (m4a ổn định, CORS *, không signed expire)
    if (it.preview_url) preview_url = it.preview_url;
    isrc = isrc || it.isrc;
    if (!image_url && it.image_url) image_url = it.image_url;
    if (!apple_music_url && it.apple_music_url) apple_music_url = it.apple_music_url;
    if (!album && it.album) album = it.album;
    if (!artist && it.artist) artist = it.artist;
    if (it.preview_url) source = `${source}+itunes`;
  }

  // Retry iTunes nếu vẫn thiếu isrc/preview (đổi country VN)
  if ((!isrc || isEphemeralPreview(preview_url)) && song_name) {
    try {
      const r = await http.get("https://itunes.apple.com/search", {
        params: {
          term: [song_name, artist].filter(Boolean).join(" "),
          entity: "song",
          limit: 5,
          country: "VN",
        },
        timeout: 10000,
      });
      const hit = (r.data?.results || [])[0];
      if (hit) {
        if (hit.previewUrl && isEphemeralPreview(preview_url)) {
          preview_url = hit.previewUrl;
          source = `${source}+itunes-vn`;
        }
        isrc = isrc || hit.isrc || null;
        if (!apple_music_url && hit.trackViewUrl) {
          apple_music_url = hit.trackViewUrl;
        }
      }
    } catch (e) {
      console.warn("enrichMusicMeta itunes-vn:", e.message);
    }
  }

  return {
    song_name,
    artist,
    album,
    image_url,
    preview_url,
    isrc,
    apple_music_url,
    spotify_url,
    source,
  };
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

/**
 * Spotify từ link track — pipeline tối ưu:
 * 1) oEmbed (title+cover, nhanh)
 * 2) Spotify Web API official (isrc + meta đầy đủ) nếu có CLIENT_ID/SECRET
 * 3) song.link chỉ khi còn thiếu isrc/preview path (chậm hơn, phụ)
 * 4) Deezer/iTunes enrich preview ổn định
 *
 * Không search theo tên làm bước chính (chậm, dễ gãy).
 */
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

  // Song song: oEmbed (nhanh) + official API (đủ data)
  const [official, oembed] = await Promise.all([
    fetchSpotifyOfficial(trackId),
    fetchSpotifyOembed(cleanUrl),
  ]);

  let merged = {
    song_name: official?.song_name || oembed?.song_name || "",
    artist: official?.artist || oembed?.artist || "",
    album: official?.album || "",
    image_url: official?.image_url || oembed?.image_url || "",
    preview_url: official?.preview_url || null,
    isrc: official?.isrc || null,
    spotify_url: official?.spotify_url || cleanUrl,
    apple_music_url: null,
    deezerId: null,
    source: official?.source || oembed?.source || "none",
  };

  // song.link chỉ khi còn thiếu ISRC hoặc cần map Deezer/Apple (tránh chậm không cần)
  if (!merged.isrc || !merged.song_name) {
    const songlink = await fetchSongLink(cleanUrl).catch(() => null);
    if (songlink) {
      merged.song_name = merged.song_name || songlink.song_name || "";
      merged.artist = merged.artist || songlink.artist || "";
      merged.image_url = merged.image_url || songlink.image_url || "";
      merged.spotify_url =
        merged.spotify_url || songlink.spotify_url || cleanUrl;
      merged.apple_music_url = songlink.apple_music_url || null;
      merged.deezerId = songlink.deezerId || null;
      if (songlink.source) merged.source = `${merged.source}+songlink`;
    }
  }

  if (!merged.song_name) {
    const err = new Error(
      "Không tìm thấy bài hát trên Spotify (link có thể đã gỡ hoặc không công khai).",
    );
    err.status = 404;
    throw err;
  }

  // Preview ổn định + ISRC (Deezer/iTunes) — bắt buộc cho Locket app + web play
  merged = await enrichMusicMeta(merged);
  return toClientShape(merged, "spotify", cleanUrl);
}

async function getAppleMusicInfoLocal(url) {
  const [itunes, songlink] = await Promise.all([
    fetchAppleItunes(url),
    fetchSongLink(url).catch(() => null),
  ]);

  let merged = {
    song_name: itunes?.song_name || songlink?.song_name || "",
    artist: itunes?.artist || songlink?.artist || "",
    album: itunes?.album || "",
    image_url: itunes?.image_url || songlink?.image_url || "",
    preview_url: itunes?.preview_url || null,
    isrc: itunes?.isrc || null,
    apple_music_url: itunes?.apple_music_url || url,
    spotify_url: songlink?.spotify_url || null,
    deezerId: songlink?.deezerId || null,
    source: itunes?.source || songlink?.source || "none",
  };

  if (!merged.song_name) {
    const err = new Error(
      "Không tìm thấy bài hát trên Apple Music (link không hợp lệ hoặc không hỗ trợ).",
    );
    err.status = 404;
    throw err;
  }

  merged = await enrichMusicMeta(merged);
  return toClientShape(merged, "apple", url);
}

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

/**
 * Tìm nhạc theo tên — KHÔNG cần user OAuth.
 * 1) Spotify Web API search (client credentials)
 * 2) Fallback Deezer search
 */
async function searchMusicByQuery(query, limit = 15) {
  const q = String(query || "").trim();
  if (!q || q.length < 1) {
    const err = new Error("Nhập tên bài hát để tìm");
    err.status = 400;
    throw err;
  }
  const lim = Math.min(Math.max(Number(limit) || 15, 1), 25);

  // 1) Spotify official search
  try {
    const token = await getSpotifyAppToken();
    if (token) {
      const r = await axios.get("https://api.spotify.com/v1/search", {
        params: { q, type: "track", limit: lim, market: "US" },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 12000,
      });
      const items = r.data?.tracks?.items || [];
      if (items.length) {
        return items.map((t) => ({
          id: t.id,
          song_name: t.name || "",
          song_title: t.name || "",
          name: t.name || "",
          artist: (t.artists || []).map((a) => a.name).join(", "),
          album: t.album?.name || "",
          image_url:
            t.album?.images?.[0]?.url ||
            t.album?.images?.[1]?.url ||
            "",
          preview_url: t.preview_url || null,
          isrc: t.external_ids?.isrc || null,
          spotify_url:
            t.external_urls?.spotify ||
            `https://open.spotify.com/track/${t.id}`,
          duration_ms: t.duration_ms || 0,
          platform: "spotify",
          source: "spotify-search",
          title: [t.name, (t.artists || []).map((a) => a.name).join(", ")]
            .filter(Boolean)
            .join(" - "),
        }));
      }
    }
  } catch (e) {
    console.warn("searchMusicByQuery spotify:", e.message);
  }

  // 2) Deezer fallback (không cần key)
  try {
    const s = await http.get("https://api.deezer.com/search", {
      params: { q, limit: lim },
      timeout: 12000,
    });
    const hits = s.data?.data || [];
    return hits.map((t) => ({
      id: String(t.id),
      song_name: t.title || "",
      song_title: t.title || "",
      name: t.title || "",
      artist: t.artist?.name || "",
      album: t.album?.title || "",
      image_url:
        t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || "",
      preview_url: t.preview || null,
      isrc: t.isrc || null,
      spotify_url: null,
      deezer_url: t.link || null,
      duration_ms: (t.duration || 0) * 1000,
      platform: "spotify",
      source: "deezer-search",
      title: [t.title, t.artist?.name].filter(Boolean).join(" - "),
    }));
  } catch (e) {
    console.warn("searchMusicByQuery deezer:", e.message);
  }

  return [];
}

module.exports = {
  fetchMusicApi,
  getSpotifyMusicInfo,
  getAppleMusicInfoLocal,
  extractSpotifyTrackId,
  searchMusicByQuery,
  getSpotifyAppToken,
};
