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

  // Song song: official (ISRC) + oEmbed + song.link (chậm nhưng tin cậy)
  const [official, oembed, songlink] = await Promise.all([
    fetchSpotifyOfficial(trackId),
    fetchSpotifyOembed(cleanUrl),
    fetchSongLink(cleanUrl).catch(() => null),
  ]);

  // Official API đôi khi fail market — thử thêm market VN/US
  let official2 = null;
  if (!official?.song_name || !official?.isrc) {
    official2 = await fetchSpotifyOfficialWithMarket(trackId).catch(() => null);
  }

  let merged = {
    song_name:
      official?.song_name ||
      official2?.song_name ||
      oembed?.song_name ||
      songlink?.song_name ||
      "",
    artist:
      official?.artist ||
      official2?.artist ||
      oembed?.artist ||
      songlink?.artist ||
      "",
    album: official?.album || official2?.album || "",
    image_url:
      official?.image_url ||
      official2?.image_url ||
      oembed?.image_url ||
      songlink?.image_url ||
      "",
    preview_url: official?.preview_url || official2?.preview_url || null,
    isrc: official?.isrc || official2?.isrc || null,
    spotify_url:
      official?.spotify_url ||
      official2?.spotify_url ||
      songlink?.spotify_url ||
      cleanUrl,
    apple_music_url: songlink?.apple_music_url || null,
    deezerId: songlink?.deezerId || null,
    source:
      official?.source ||
      official2?.source ||
      oembed?.source ||
      songlink?.source ||
      "spotify",
  };

  // Vẫn thiếu tên: enrich từ Deezer/iTunes bằng... chưa có tên → thử Deezer isrc lookup skip
  // Preview ổn định + ISRC (Deezer/iTunes) — chấp nhận chậm
  if (merged.song_name || merged.deezerId) {
    merged = await enrichMusicMeta(merged);
  } else {
    // Thử Deezer/iTunes với id không có tên (chỉ deezerId)
    if (merged.deezerId) {
      const dz = await enrichFromDeezer(merged.deezerId, "", "");
      if (dz) {
        merged.song_name = dz.song_name || merged.song_name;
        merged.artist = dz.artist || merged.artist;
        merged.isrc = merged.isrc || dz.isrc;
        merged.preview_url = merged.preview_url || dz.preview_url;
        merged.image_url = merged.image_url || dz.image_url;
      }
    }
  }

  // Lần cuối: search Spotify theo track id qua API (đã có) — nếu vẫn trống
  if (!merged.song_name && trackId) {
    const again = await fetchSpotifyOfficial(trackId);
    if (again?.song_name) {
      merged = { ...merged, ...again, spotify_url: cleanUrl };
      merged = await enrichMusicMeta(merged);
    }
  }

  if (!merged.song_name) {
    // Không throw cứng — trả minimal để client fallback search theo tên
    const err = new Error(
      "Không tìm thấy bài hát trên Spotify (link có thể đã gỡ hoặc không công khai).",
    );
    err.status = 404;
    throw err;
  }

  // Bắt buộc cố lấy ISRC (Locket app)
  if (!merged.isrc) {
    merged = await enrichMusicMeta(merged);
  }

  return toClientShape(merged, "spotify", cleanUrl);
}

/** Spotify track với market=VN rồi US — bổ sung ISRC/preview */
async function fetchSpotifyOfficialWithMarket(trackId) {
  if (!trackId) return null;
  const accessToken = await getSpotifyAppToken();
  if (!accessToken) return null;
  for (const market of ["VN", "US"]) {
    try {
      const tr = await axios.get(
        `https://api.spotify.com/v1/tracks/${trackId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: { market },
          timeout: 12000,
        },
      );
      const d = tr.data;
      if (!d?.name) continue;
      return {
        song_name: d.name,
        artist: (d.artists || []).map((a) => a.name).join(", "),
        album: d.album?.name || "",
        image_url: d.album?.images?.[0]?.url || d.album?.images?.[1]?.url || "",
        preview_url: d.preview_url || null,
        isrc: d.external_ids?.isrc || null,
        spotify_url:
          d.external_urls?.spotify || normalizeSpotifyUrl("", trackId),
        source: `spotify-api-${market}`,
      };
    } catch (e) {
      console.warn(`fetchSpotifyOfficial market=${market}:`, e.message);
    }
  }
  return null;
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

/** Chuẩn hóa tiếng Việt để so khớp (bỏ dấu, đ→d, lowercase) */
function normalizeSearchText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Khớp token theo TỪ — tránh "tim" dính trong "time", "em" trong "remember". */
function tokenAsWord(token, text) {
  if (!token || !text) return false;
  const t = escapeRegExp(token);
  if (new RegExp(`(?:^|\\s)${t}(?:\\s|$)`).test(text)) return true;
  if (token.length >= 5 && new RegExp(`(?:^|\\s)${t}`).test(text)) return true;
  return false;
}

function scoreTrackMatch(query, track) {
  const q = normalizeSearchText(query);
  const title = normalizeSearchText(
    track.song_title || track.song_name || track.name || track.title || "",
  );
  const artist = normalizeSearchText(track.artist || "");
  const full = `${title} ${artist}`.trim();
  if (!q || !title) return 0;

  const tokens = q.split(" ").filter((t) => t.length > 0);
  if (!tokens.length) return 0;

  const inTitleWords = tokens.filter((t) => tokenAsWord(t, title));
  const inFullWords = tokens.filter((t) => tokenAsWord(t, full));
  const phraseInTitle = title === q || title.includes(q);

  if (tokens.length >= 2) {
    if (!phraseInTitle && inTitleWords.length < tokens.length) {
      if (inFullWords.length < tokens.length) return 0;
    }
  } else if (!tokenAsWord(tokens[0], full) && !phraseInTitle) {
    return 0;
  }

  let score = 0;
  if (title === q) score += 5000;
  else if (title.startsWith(`${q} `) || title.startsWith(q)) score += 2500;
  if (phraseInTitle) score += 1500;
  if (tokens.length > 1 && title.includes(tokens.join(" "))) score += 1200;

  const ratioTitle = inTitleWords.length / tokens.length;
  score += ratioTitle * 800;
  score += (inFullWords.length / tokens.length) * 100;

  if (tokens.length >= 2 && inTitleWords.length === 1) score *= 0.05;
  else if (tokens.length >= 2 && inTitleWords.length < tokens.length) {
    score *= 0.25 + 0.25 * ratioTitle;
  }

  if (typeof track.popularity === "number" && score >= 200) {
    score += Math.min(40, track.popularity * 0.25);
  }

  if (
    tokens.length >= 2 &&
    !phraseInTitle &&
    inTitleWords.length < tokens.length &&
    score < 500
  ) {
    return 0;
  }

  return score;
}

function rankAndFilterTracks(query, tracks, limit) {
  const scored = (tracks || [])
    .map((t) => ({ t, s: scoreTrackMatch(query, t) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (!scored.length) return [];

  const top = scored[0].s;
  const minKeep =
    top >= 1500 ? Math.max(400, top * 0.2) : top >= 500 ? 200 : top * 0.85;
  const filtered = scored.filter((x) => x.s >= minKeep).map((x) => x.t);
  return (filtered.length ? filtered : scored.slice(0, 3).map((x) => x.t)).slice(
    0,
    limit,
  );
}


function mapSpotifyTrack(t) {
  return {
    id: t.id,
    song_name: t.name || "",
    song_title: t.name || "",
    name: t.name || "",
    artist: (t.artists || []).map((a) => a.name).join(", "),
    album: t.album?.name || "",
    image_url:
      t.album?.images?.[0]?.url || t.album?.images?.[1]?.url || "",
    preview_url: t.preview_url || null,
    isrc: t.external_ids?.isrc || null,
    spotify_url:
      t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
    duration_ms: t.duration_ms || 0,
    popularity: t.popularity || 0,
    platform: "spotify",
    source: "spotify-search",
    title: [t.name, (t.artists || []).map((a) => a.name).join(", ")]
      .filter(Boolean)
      .join(" - "),
  };
}

function mapDeezerTrack(t) {
  return {
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
    popularity: t.rank ? Math.min(100, Math.round(Number(t.rank) / 10000)) : 0,
    platform: "spotify",
    source: "deezer-search",
    title: [t.title, t.artist?.name].filter(Boolean).join(" - "),
  };
}

function mapITunesTrack(t) {
  return {
    id: String(t.trackId || t.collectionId || ""),
    song_name: t.trackName || "",
    song_title: t.trackName || "",
    name: t.trackName || "",
    artist: t.artistName || "",
    album: t.collectionName || "",
    image_url: (t.artworkUrl100 || "").replace("100x100", "600x600") || "",
    preview_url: t.previewUrl || null,
    isrc: null,
    spotify_url: null,
    apple_music_url: t.trackViewUrl || null,
    duration_ms: t.trackTimeMillis || 0,
    popularity: 50,
    platform: "spotify",
    source: "itunes-search",
    title: [t.trackName, t.artistName].filter(Boolean).join(" - "),
  };
}

/**
 * Spotify Web API search — full catalog (primary).
 * Up to 50 tracks / market; merge VN + US for broader hits.
 */
async function fetchSpotifySearchFull(q, limit = 50) {
  try {
    const token = await Promise.race([
      getSpotifyAppToken(),
      new Promise((r) => setTimeout(() => r(null), 8000)),
    ]);
    if (!token) {
      console.warn("searchMusic spotify: no app token");
      return [];
    }

    const lim = Math.min(50, Math.max(Number(limit) || 50, 20));
    const headers = { Authorization: `Bearer ${token}` };

    // Parallel markets — VN (local) + US (global catalog)
    const markets = ["VN", "US"];
    const results = await Promise.all(
      markets.map(async (market) => {
        try {
          const r = await axios.get("https://api.spotify.com/v1/search", {
            params: {
              q,
              type: "track",
              limit: lim,
              market,
              include_external: "audio",
            },
            headers,
            timeout: 10000,
          });
          return (r.data?.tracks?.items || []).filter(Boolean);
        } catch (e) {
          console.warn(`searchMusic spotify market=${market}:`, e.message);
          return [];
        }
      }),
    );

    // Dedupe by track id, keep highest popularity
    const byId = new Map();
    for (const items of results) {
      for (const t of items) {
        if (!t?.id) continue;
        const prev = byId.get(t.id);
        if (!prev || (t.popularity || 0) > (prev.popularity || 0)) {
          byId.set(t.id, t);
        }
      }
    }

    // Sort by popularity (Spotify relevance already applied per market)
    return [...byId.values()]
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .map(mapSpotifyTrack);
  } catch (e) {
    console.warn("searchMusic spotify full:", e.message);
    return [];
  }
}

/**
 * Tìm nhạc — ƯU TIÊN Spotify full catalog.
 * Deezer + iTunes chỉ bổ sung preview/ISRC khi Spotify thiếu.
 */
async function searchMusicByQuery(query, limit = 30) {
  const q = String(query || "").trim();
  if (!q || q.length < 1) {
    const err = new Error("Nhập tên bài hát để tìm");
    err.status = 400;
    throw err;
  }
  // Cho phép trả nhiều kết quả Spotify (tối đa 50)
  const lim = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const fetchLim = Math.min(50, Math.max(lim, 30));
  const merged = new Map();

  const addTrack = (t, prefer = false) => {
    if (!t) return;
    const key =
      t.id ||
      t.spotify_url ||
      t.isrc ||
      t.deezer_url ||
      t.apple_music_url ||
      `${normalizeSearchText(t.song_title || t.name)}|${normalizeSearchText(t.artist)}`;
    if (!key || key === "|") return;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, t);
      return;
    }
    // Prefer Spotify-sourced track over Deezer/iTunes clones
    const prevSp = prev.source === "spotify-search" || prev.spotify_url;
    const nextSp = t.source === "spotify-search" || t.spotify_url;
    if (prefer || (nextSp && !prevSp)) {
      merged.set(key, { ...prev, ...t, spotify_url: t.spotify_url || prev.spotify_url });
    } else if (!prev.preview_url && t.preview_url) {
      merged.set(key, { ...prev, preview_url: t.preview_url, isrc: prev.isrc || t.isrc });
    }
  };

  // 1) Spotify FULL — primary
  const spotifyTracks = await fetchSpotifySearchFull(q, fetchLim);
  for (const t of spotifyTracks) addTrack(t, true);

  // 2) Deezer + iTunes song song — fill preview / fallback nếu Spotify trống
  const needFallback = spotifyTracks.length < Math.min(10, lim);
  const [deezerTracks, itunesTracks] = await Promise.all([
    (async () => {
      try {
        const s = await http.get("https://api.deezer.com/search", {
          params: { q, limit: needFallback ? fetchLim : 10 },
          timeout: 7000,
        });
        return (s.data?.data || []).map(mapDeezerTrack);
      } catch (e) {
        console.warn("searchMusic deezer:", e.message);
        return [];
      }
    })(),
    (async () => {
      try {
        const s = await axios.get("https://itunes.apple.com/search", {
          params: {
            term: q,
            media: "music",
            entity: "song",
            limit: needFallback ? fetchLim : 10,
            country: "vn",
          },
          timeout: 7000,
          headers: { "User-Agent": UA },
          validateStatus: (st) => st >= 200 && st < 500,
        });
        return (s.data?.results || []).map(mapITunesTrack);
      } catch (e) {
        console.warn("searchMusic itunes:", e.message);
        return [];
      }
    })(),
  ]);

  for (const t of deezerTracks) addTrack(t, false);
  for (const t of itunesTracks) addTrack(t, false);

  const all = [...merged.values()];

  // Spotify-first soft rank: boost spotify-search + popularity
  const scored = all
    .map((t) => {
      let s = scoreTrackMatch(q, t);
      if (t.source === "spotify-search" || t.spotify_url) {
        s = s > 0 ? s + 200 : 50 + (t.popularity || 0);
        s += Math.min(80, (t.popularity || 0) * 0.6);
      }
      return { t, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => {
      // Spotify first among similar scores
      const aSp = a.t.source === "spotify-search" ? 1 : 0;
      const bSp = b.t.source === "spotify-search" ? 1 : 0;
      if (bSp !== aSp && Math.abs(b.s - a.s) < 300) return bSp - aSp;
      return b.s - a.s;
    });

  let ranked = scored.map((x) => x.t);

  // If score filter emptied list but Spotify returned raw hits — return raw Spotify
  if (!ranked.length && spotifyTracks.length) {
    ranked = spotifyTracks;
  } else if (!ranked.length && all.length) {
    ranked = all;
  }

  // Prefer list that has many Spotify tracks when available
  const spotifyOnly = ranked.filter(
    (t) => t.source === "spotify-search" || t.spotify_url,
  );
  if (spotifyOnly.length >= Math.min(8, lim)) {
    // Interleave: keep Spotify order (popularity) first, then others
    const others = ranked.filter(
      (t) => !(t.source === "spotify-search" || t.spotify_url),
    );
    ranked = [...spotifyOnly, ...others];
  }

  return ranked.slice(0, lim);
}

module.exports = {
  fetchMusicApi,
  getSpotifyMusicInfo,
  getAppleMusicInfoLocal,
  extractSpotifyTrackId,
  searchMusicByQuery,
  getSpotifyAppToken,
};
