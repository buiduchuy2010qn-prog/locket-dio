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
  const s = String(url || "").trim();
  // open.spotify.com(/intl-xx)?/track/ID  |  spotify:track:ID  |  embed/track/ID
  const m = s.match(
    /(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?track\/|spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]{10,})/i,
  );
  if (m) return m[1];
  // bare track id in path tail
  const m2 = s.match(/\/track\/([a-zA-Z0-9]{10,})/i);
  return m2 ? m2[1] : null;
}

/** Follow spotify.link / app link short URLs → open.spotify.com/track/... */
async function expandSpotifyShortUrl(url = "") {
  const s = String(url || "").trim();
  if (!s) return s;
  if (extractSpotifyTrackId(s)) return s;
  if (!/spotify\.(link|app\.link)|sptfy\.com/i.test(s)) return s;
  try {
    const r = await axios.get(s, {
      timeout: 12000,
      maxRedirects: 5,
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      validateStatus: (st) => st >= 200 && st < 400,
    });
    const finalUrl =
      r.request?.res?.responseUrl ||
      r.request?.responseURL ||
      r.headers?.location ||
      s;
    if (extractSpotifyTrackId(finalUrl)) return finalUrl;
    const html = typeof r.data === "string" ? r.data : "";
    const fromHtml = html.match(
      /https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/[a-zA-Z0-9]+/i,
    );
    if (fromHtml) return fromHtml[0];
  } catch (e) {
    console.warn("expandSpotifyShortUrl:", e.message);
  }
  return s;
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
/** Spotify Dev app without Premium → 403; skip API for a while */
let spotifyApiBlockedUntil = 0;

function markSpotifyApiBlocked(err) {
  const msg = String(err?.response?.data?.error?.message || err?.message || "");
  const status = err?.response?.status;
  if (
    status === 403 ||
    /premium subscription required|insufficient client scope/i.test(msg)
  ) {
    spotifyApiBlockedUntil = Date.now() + 6 * 60 * 60 * 1000; // 6h
    console.warn(
      "getSpotifyAppToken: Spotify Web API blocked (Premium required) — using Deezer/iTunes",
    );
    return true;
  }
  return false;
}

async function getSpotifyAppToken() {
  if (Date.now() < spotifyApiBlockedUntil) return null;
  // Client credentials — chỉ từ env (không hardcode secret trong source)
  const clientId =
    process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID || "";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    console.warn(
      "getSpotifyAppToken: missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET",
    );
    return null;
  }
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
    markSpotifyApiBlocked(e);
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
  if (Date.now() < spotifyApiBlockedUntil) return null;
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
    markSpotifyApiBlocked(e);
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

/**
 * Chuẩn hoá Apple Music URL cho Locket app.
 * Bỏ query rác (uo, ls, at, ct…) — chỉ giữ path + ?i=trackId.
 * geo.music.apple.com → music.apple.com
 */
function normalizeAppleMusicUrl(url = "") {
  const s = String(url || "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^geo\./i, "").toLowerCase();
    if (!/^(music|itunes)\.apple\.com$/i.test(host)) return s.split("?")[0] || s;
    const trackId = u.searchParams.get("i");
    // pathname: /vn/album/name/albumId
    let path = u.pathname || "";
    if (!path.startsWith("/")) path = `/${path}`;
    let out = `https://music.apple.com${path}`;
    if (trackId) out += `?i=${trackId}`;
    return out;
  } catch {
    return s.replace(/[?&]uo=\d+/gi, "").replace(/[?&]ls=1/gi, "") || s;
  }
}

function isStablePreviewUrl(url = "") {
  const u = String(url || "");
  if (!u) return false;
  // iTunes / Apple CDN preview — ổn định
  if (/audio-ssl\.itunes\.apple\.com|mzstatic\.com.*AudioPreview/i.test(u)) {
    return true;
  }
  // Deezer signed / Spotify short preview — hết hạn hoặc chặn
  if (/dzcdn\.net|hdnea=|p\.scdn\.co/i.test(u)) return false;
  return true;
}

function isStableCoverUrl(url = "") {
  const u = String(url || "");
  if (!u) return false;
  if (/mzstatic\.com|scdn\.co|i\.scdn\.co/i.test(u)) return true;
  if (/dzcdn\.net/i.test(u)) return false;
  return true;
}

/** iTunes — preview .m4a ổn định; ưu tiên VN (nhạc Việt) rồi US */
async function enrichFromItunes(songName, artist) {
  if (!songName) return null;
  const term = [songName, artist].filter(Boolean).join(" ");
  const nameL = songName.toLowerCase();
  const artistL = (artist || "").toLowerCase();

  for (const country of ["vn", "us"]) {
    try {
      const r = await http.get("https://itunes.apple.com/search", {
        params: {
          term,
          entity: "song",
          limit: 8,
          country,
        },
        timeout: 12000,
      });
      const hits = r.data?.results || [];
      if (!hits.length) continue;

      const best =
        hits.find(
          (t) =>
            t.trackName?.toLowerCase() === nameL ||
            (t.trackName?.toLowerCase().includes(nameL.slice(0, 10)) &&
              (!artistL ||
                t.artistName?.toLowerCase().includes(artistL.slice(0, 8)))),
        ) || hits[0];

      let isrc = best.isrc || null;
      if (best.trackId) {
        try {
          const lk = await http.get("https://itunes.apple.com/lookup", {
            params: { id: best.trackId, country },
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
        apple_music_url: normalizeAppleMusicUrl(best.trackViewUrl) || null,
        source: `itunes-search-${country}`,
      };
    } catch (e) {
      console.warn(`enrichFromItunes country=${country}:`, e.message);
    }
  }
  return null;
}

/**
 * True if Apple URL can drive Locket iOS MusicKit (needs track id ?i=).
 */
function isPlayableAppleMusicUrl(url = "") {
  const s = String(url || "").trim();
  if (!s || !/music\.apple\.com|itunes\.apple\.com/i.test(s)) return false;
  // MusicKit / Locket iOS needs the song id query
  if (!/[?&]i=\d{5,}/.test(s)) return false;
  // Empty album slug from bad odesli maps often fails
  if (/\/album\/_\//i.test(s)) return false;
  return true;
}

async function fetchSongLink(url) {
  const countries = ["VN", "US"];
  for (const base of [
    "https://api.song.link/v1-alpha.1/links",
    "https://api.odesli.co/v1-alpha.1/links",
  ]) {
    for (const userCountry of countries) {
      try {
        const r = await http.get(base, {
          params: { url, userCountry },
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

        let appleUrl =
          r.data.linksByPlatform?.appleMusic?.url ||
          r.data.linksByPlatform?.itunes?.url ||
          null;
        // Build from entity id when platform link missing / weak
        if (!isPlayableAppleMusicUrl(appleUrl) && apple?.id) {
          const tid = String(apple.id).replace(/\D/g, "");
          if (tid.length >= 5) {
            appleUrl = `https://music.apple.com/us/song/${tid}?i=${tid}`;
          }
        }
        appleUrl = normalizeAppleMusicUrl(appleUrl || "") || appleUrl;

        return {
          song_name: primary.title,
          artist: primary.artistName || "",
          image_url: primary.thumbnailUrl || "",
          deezerId: deezer?.id || null,
          apple_music_url: appleUrl,
          spotify_url: r.data.linksByPlatform?.spotify?.url || null,
          source: `songlink-${userCountry}`,
        };
      } catch (e) {
        console.warn("fetchSongLink:", base, userCountry, e.message);
      }
    }
  }
  return null;
}

async function fetchAppleItunes(url) {
  const appleId = extractAppleId(url);
  if (!appleId) return null;

  for (const country of ["vn", "us"]) {
    try {
      const { data } = await http.get("https://itunes.apple.com/lookup", {
        params: { id: appleId, country },
        timeout: 12000,
      });
      const track = data?.results?.[0];
      if (!track) continue;

      return {
        song_name: track.trackName || track.collectionName,
        artist: track.artistName || "",
        album: track.collectionName || "",
        image_url: (track.artworkUrl100 || "").replace("100x100", "600x600"),
        preview_url: track.previewUrl || null,
        isrc: track.isrc || null,
        apple_music_url:
          normalizeAppleMusicUrl(track.trackViewUrl || url) ||
          normalizeAppleMusicUrl(url),
        source: `itunes-${country}`,
      };
    } catch (e) {
      console.warn(`fetchAppleItunes country=${country}:`, e.message);
    }
  }
  return null;
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
    isrc = isrc || normalizeIsrc(dz.isrc);
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
    isrc = isrc || normalizeIsrc(it.isrc);
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
        isrc = isrc || normalizeIsrc(hit.isrc);
        if (!apple_music_url && hit.trackViewUrl) {
          apple_music_url = hit.trackViewUrl;
        }
      }
    } catch (e) {
      console.warn("enrichMusicMeta itunes-vn:", e.message);
    }
  }

  // MusicBrainz nếu vẫn thiếu ISRC
  if (!isrc && song_name) {
    const mb = await fetchIsrcFromMusicBrainz(song_name, artist);
    if (mb) {
      isrc = mb;
      source = `${source}+mb-isrc`;
    }
  }

  return {
    song_name,
    artist,
    album,
    image_url,
    preview_url,
    isrc: normalizeIsrc(isrc),
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
 * Spotify từ link track — KHÔNG phụ thuộc Spotify Web API (hay 403 Premium).
 * 1) Expand short link
 * 2) Song song: oEmbed + song.link + official (optional)
 * 3) Deezer/iTunes enrich ISRC + preview (bắt buộc cho Locket)
 * 4) Search Deezer theo tên nếu vẫn thiếu ISRC
 */
async function getSpotifyMusicInfo(url) {
  const expanded = await expandSpotifyShortUrl(url);
  const trackId = extractSpotifyTrackId(expanded);
  if (!trackId) {
    const err = new Error(
      "URL Spotify không hợp lệ. Cần link dạng open.spotify.com/track/...",
    );
    err.status = 400;
    throw err;
  }

  const cleanUrl = normalizeSpotifyUrl(expanded, trackId);

  // oEmbed + song.link là đường chính (không cần Premium Spotify app)
  // Official API optional — nhiều app bị 403 "premium subscription required"
  const [oembed, songlink, official] = await Promise.all([
    fetchSpotifyOembed(cleanUrl),
    fetchSongLink(cleanUrl).catch(() => null),
    fetchSpotifyOfficial(trackId).catch(() => null),
  ]);

  let official2 = null;
  if (!official?.isrc && !official?.song_name) {
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

  // Preview + ISRC qua Deezer/iTunes — chấp nhận chậm
  if (merged.song_name || merged.deezerId) {
    merged = await enrichMusicMeta(merged);
  } else if (merged.deezerId) {
    const dz = await enrichFromDeezer(merged.deezerId, "", "");
    if (dz) {
      merged.song_name = dz.song_name || merged.song_name;
      merged.artist = dz.artist || merged.artist;
      merged.isrc = merged.isrc || dz.isrc;
      merged.preview_url = merged.preview_url || dz.preview_url;
      merged.image_url = merged.image_url || dz.image_url;
    }
  }

  // Vẫn thiếu meta/ISRC: search Deezer theo tên (oEmbed thường đủ tên)
  if ((!merged.isrc || !merged.song_name) && (merged.song_name || trackId)) {
    const q = [merged.song_name, merged.artist].filter(Boolean).join(" ");
    if (q) {
      const dz = await enrichFromDeezer(null, merged.song_name || q, merged.artist);
      if (dz) {
        merged.song_name = merged.song_name || dz.song_name || "";
        merged.artist = merged.artist || dz.artist || "";
        merged.isrc = merged.isrc || dz.isrc;
        merged.preview_url = merged.preview_url || dz.preview_url;
        merged.image_url = merged.image_url || dz.image_url;
        if (dz.isrc) merged.source = `${merged.source}+deezer-isrc`;
      }
    }
  }

  // Lần cuối: enrich lại nếu có tên
  if (merged.song_name && !merged.isrc) {
    merged = await enrichMusicMeta(merged);
  }

  // ISRC bắt buộc cho Locket app — Deezer/iTunes/MusicBrainz
  if (!normalizeIsrc(merged.isrc) && merged.song_name) {
    const forced = await resolveIsrcAggressive({
      songName: merged.song_name,
      artist: merged.artist,
      deezerId: merged.deezerId,
    });
    if (forced) {
      merged.isrc = forced;
      merged.source = `${merged.source || "spotify"}+isrc-force`;
    }
  }
  merged.isrc = normalizeIsrc(merged.isrc);

  if (!merged.song_name) {
    const err = new Error(
      "Không tìm thấy bài hát trên Spotify (link có thể đã gỡ hoặc không công khai).",
    );
    err.status = 404;
    throw err;
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
  // ISRC bắt buộc cho Locket app
  if (!normalizeIsrc(merged.isrc) && merged.song_name) {
    const forced = await resolveIsrcAggressive({
      songName: merged.song_name,
      artist: merged.artist,
      deezerId: merged.deezerId,
    });
    if (forced) {
      merged.isrc = forced;
      merged.source = `${merged.source || "apple"}+isrc-force`;
    }
  }
  merged.isrc = normalizeIsrc(merged.isrc);
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

/** Cover / karaoke / piano… — không được đứng trên bản gốc khi đăng Locket */
function isCoverOrDerivative(track, query = "") {
  const blob = normalizeSearchText(
    [
      track.song_title || track.song_name || track.name || track.title || "",
      track.artist || "",
      track.album || "",
    ].join(" "),
  );
  const q = normalizeSearchText(query);
  // Chỉ phạt remix/acoustic khi user không gõ từ đó
  const wantsAlt =
    /\b(remix|acoustic|cover|live|instrumental|karaoke)\b/.test(q);
  if (
    /\b(cover|covers|piano|karaoke|tribute|rendition|instrumental|nightcore|slowed|reverb|quartet|orchestra|ringtone|parody|8d|8 bit|8bit|lofi|music box|violin|guitar cover|drum cover|emulation)\b/.test(
      blob,
    )
  ) {
    return true;
  }
  if (
    !wantsAlt &&
    /\b(remix|acoustic|live version|piano version|slowed)\b/.test(blob)
  ) {
    return true;
  }
  return false;
}

/** Title sạch (bỏ ngoặc) — ưu tiên "Shape of You" hơn "Shape of You (Acoustic)" */
function cleanTrackTitle(track) {
  const raw =
    track.song_title || track.song_name || track.name || track.title || "";
  return normalizeSearchText(raw)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Điểm khớp query — tên bài HOẶC tên ca sĩ (như Spotify).
 * - "tim em" → khớp title
 * - "sơn tùng" → khớp artist
 * - "pink venom blackpink" → title + artist (không ưu tiên cover nhét artist vào title)
 * Token ngắn (em, tim) chỉ word-boundary, không dính "time"/"remember".
 */
function scoreTrackMatch(query, track) {
  const q = normalizeSearchText(query);
  const title = normalizeSearchText(
    track.song_title || track.song_name || track.name || track.title || "",
  );
  const artist = normalizeSearchText(track.artist || "");
  const full = `${title} ${artist}`.trim();
  if (!q || (!title && !artist)) return 0;

  const tokens = q.split(" ").filter((t) => t.length >= 2);
  if (!tokens.length) return 0;

  const joined = tokens.join(" ");
  const phraseInTitle = Boolean(title) && (title === q || title.includes(q));
  const phraseExactTitle = title === q;
  const phraseStartsTitle =
    Boolean(title) && (title.startsWith(q) || title.startsWith(`${q} `));
  const phraseInArtist =
    Boolean(artist) &&
    (artist === q || artist.includes(q) || artist.startsWith(q));
  const phraseExactArtist = artist === q;

  const shortTokens = tokens.filter((t) => t.length <= 3);
  const inTitle = title ? tokens.filter((t) => tokenAsWord(t, title)) : [];
  const inArtist = artist ? tokens.filter((t) => tokenAsWord(t, artist)) : [];
  const inFull = tokens.filter((t) => tokenAsWord(t, full));

  // ── Path A: khớp NGHỆ SĨ (tìm theo tên ca sĩ) ──
  const allInArtist =
    artist &&
    tokens.length >= 1 &&
    tokens.every((t) => tokenAsWord(t, artist) || artist.includes(joined));
  const artistOk =
    phraseInArtist ||
    (allInArtist &&
      shortTokens.every((t) => tokenAsWord(t, artist) || phraseInArtist));

  // ── Path B: khớp TITLE ──
  let titleOk = phraseInTitle;
  if (!titleOk && title) {
    const hasJoined = title.includes(joined);
    let ok = true;
    for (const t of shortTokens) {
      if (!tokenAsWord(t, title) && !hasJoined) {
        ok = false;
        break;
      }
    }
    if (ok) {
      for (const t of tokens.filter((x) => x.length > 3)) {
        if (
          !tokenAsWord(t, title) &&
          !title.startsWith(t) &&
          !hasJoined &&
          !tokenAsWord(t, full)
        ) {
          ok = false;
          break;
        }
      }
    }
    if (ok && tokens.length >= 2 && !hasJoined) {
      if (inTitle.length < Math.ceil(tokens.length * 0.75)) ok = false;
    } else if (ok && tokens.length === 1) {
      if (!tokenAsWord(tokens[0], title) && !title.startsWith(tokens[0])) {
        ok = false;
      }
    }
    titleOk = ok;
  }

  // Path C: title + artist chia token (vd "pink venom blackpink")
  const splitOk =
    tokens.length >= 2 &&
    inFull.length === tokens.length &&
    inTitle.length >= 1 &&
    inArtist.length >= 1;

  if (!titleOk && !artistOk && !splitOk) return 0;

  let score = 0;

  // Title stuffing: "Pink Venom (BLACKPINK)" khớp full query nhưng artist ≠ BLACKPINK
  const titleStuffedArtist =
    phraseExactTitle &&
    tokens.length >= 2 &&
    inArtist.length === 0 &&
    inTitle.length === tokens.length;

  if (phraseExactTitle && !titleStuffedArtist) score += 8000;
  else if (titleStuffedArtist) score += 600; // cover/nhét artist vào title
  else if (phraseStartsTitle) score += 4000;
  else if (phraseInTitle) score += 2500;
  if (tokens.length > 1 && title.includes(joined) && !titleStuffedArtist) {
    score += 2000;
  }
  score += (inTitle.length / tokens.length) * 1000;

  // Artist search — điểm cao đủ để hiện list bài của ca sĩ
  if (phraseExactArtist) score += 5500;
  else if (phraseInArtist) score += 4200;
  else if (artistOk) score += 3200;
  score += (inArtist.length / tokens.length) * 900;
  score += (inFull.length / tokens.length) * 40;

  // Query = "tên bài + ca sĩ" khớp đúng field
  if (splitOk) score += 4500;

  // Title sạch khớp query (không ngoặc remix/acoustic)
  const clean = cleanTrackTitle(track);
  if (clean && (clean === q || clean === joined)) score += 3500;
  else if (clean && tokens.length >= 2 && clean === tokens.slice(0, -1).join(" ") && inArtist.length >= 1) {
    // "pink venom" clean + artist blackpink
    score += 2800;
  }
  // Phạt title dài / có ngoặc khi query gọn
  const rawTitle =
    track.song_title || track.song_name || track.name || track.title || "";
  if (/\([^)]+\)|\[[^\]]+\]/.test(rawTitle) && !/[(\[]/.test(query || "")) {
    score *= 0.55;
  }

  // Title lỏng khi đang match artist: không phạt
  if (
    titleOk &&
    tokens.length >= 2 &&
    inTitle.length < tokens.length &&
    !phraseInTitle &&
    !splitOk
  ) {
    score *= 0.4 + 0.4 * (inTitle.length / tokens.length);
  }

  // Phạt cover/karaoke — Locket cần bản gốc có ISRC đúng
  if (isCoverOrDerivative(track, query)) score *= 0.12;

  if (score < 40) return 0;

  if (typeof track.popularity === "number" && score >= 200) {
    score += Math.min(40, track.popularity * 0.25);
  }
  // Deezer rank (0–1e6+) — ưu tiên bản phổ biến
  if (typeof track._deezerRank === "number" && track._deezerRank > 0) {
    score += Math.min(120, Math.log10(track._deezerRank + 1) * 16);
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
    deezerId: t.id ? String(t.id) : null,
    duration_ms: (t.duration || 0) * 1000,
    popularity: t.rank ? Math.min(100, Math.round(Number(t.rank) / 10000)) : 0,
    _deezerRank: Number(t.rank) || 0,
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
    apple_music_url: normalizeAppleMusicUrl(t.trackViewUrl) || null,
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
    if (Date.now() < spotifyApiBlockedUntil) return [];
    const token = await Promise.race([
      getSpotifyAppToken(),
      new Promise((r) => setTimeout(() => r(null), 8000)),
    ]);
    if (!token) {
      console.warn("searchMusic spotify: no app token / API blocked");
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
          markSpotifyApiBlocked(e);
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

/** Chuẩn hoá / validate ISRC (12 ký tự, bỏ gạch). Locket app bắt buộc field này. */
function normalizeIsrc(raw) {
  if (!raw) return null;
  const s = String(raw)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  // CC-XXX-YY-NNNNN → 12 chars
  if (/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(s)) return s;
  // Một số API trả 12 ký tự generic
  if (/^[A-Z0-9]{12}$/.test(s)) return s;
  return null;
}

function isValidIsrc(raw) {
  return Boolean(normalizeIsrc(raw));
}

/** Bỏ feat/ngoặc — Deezer/iTunes search ổn định hơn "Tìm Em (feat. Bảo Anh)" */
function cleanSongTitleForSearch(s) {
  return String(s || "")
    .replace(/\(.*?\)/g, " ")
    .replace(/\[.*?\]/g, " ")
    .replace(/\b(feat\.?|ft\.?|featuring|with)\s+.+$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDiacritics(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/**
 * MusicBrainz search theo tên — trả list track có ISRC (khi Deezer/iTunes down).
 */
async function searchMusicBrainzRecordings(query, limit = 12) {
  const q = String(query || "").trim();
  if (!q) return [];
  try {
    const clean = q.replace(/"/g, "").replace(/[()[\]]/g, " ").trim().slice(0, 100);
    const r = await http.get("https://musicbrainz.org/ws/2/recording", {
      params: {
        query: clean,
        fmt: "json",
        limit: Math.min(25, Math.max(5, limit)),
      },
      timeout: 14000,
      headers: {
        "User-Agent":
          "HuyLocket/1.4 (https://github.com/buiduchuy2010qn-prog/locket-dio)",
        Accept: "application/json",
      },
    });
    const recs = r.data?.recordings || [];
    const out = [];
    for (const rec of recs) {
      const isrc = normalizeIsrc((rec.isrcs || [])[0]);
      if (!isrc) continue;
      const artist =
        (rec["artist-credit"] || [])
          .map((a) => a.name || a.artist?.name)
          .filter(Boolean)
          .join(", ") || "";
      const title = rec.title || "";
      if (!title) continue;
      const blob = `${title} ${rec.disambiguation || ""}`.toLowerCase();
      if (/\b(karaoke|instrumental)\b/.test(blob)) continue;
      out.push({
        id: `mb-${rec.id || isrc}`,
        song_name: title,
        song_title: title,
        name: title,
        artist,
        album: "",
        image_url: "",
        preview_url: null,
        isrc,
        spotify_url: null,
        apple_music_url: null,
        platform: "spotify",
        source: "musicbrainz-search",
        title: [title, artist].filter(Boolean).join(" - "),
      });
    }
    return out.slice(0, limit);
  } catch (e) {
    console.warn("searchMusicBrainzRecordings:", e.message);
    return [];
  }
}

/** MusicBrainz — fallback ISRC khi Deezer miss (rate-limit nhẹ) */
async function fetchIsrcFromMusicBrainz(songName, artist) {
  if (!songName) return null;
  try {
    const clean = (s) =>
      String(s || "")
        .replace(/"/g, "")
        .replace(/[()[\]]/g, " ")
        .trim()
        .slice(0, 80);
    const parts = [`recording:"${clean(songName)}"`];
    if (artist) parts.push(`artist:"${clean(artist)}"`);
    const r = await http.get("https://musicbrainz.org/ws/2/recording", {
      params: {
        query: parts.join(" AND "),
        fmt: "json",
        limit: 8,
      },
      timeout: 12000,
      headers: {
        "User-Agent":
          "HuyLocket/1.4 (https://github.com/buiduchuy2010qn-prog/locket-dio)",
        Accept: "application/json",
      },
    });
    const recs = r.data?.recordings || [];
    // Ưu tiên bản studio có ISRC, tránh live/karaoke
    const scored = recs
      .map((rec) => {
        const isrcs = rec.isrcs || [];
        if (!isrcs.length) return null;
        const blob = `${rec.title || ""} ${rec.disambiguation || ""}`.toLowerCase();
        let s = Number(rec.score) || 50;
        if (/\b(live|karaoke|cover|remix|instrumental|acoustic)\b/.test(blob)) {
          s -= 40;
        }
        return { isrc: String(isrcs[0]).trim(), s };
      })
      .filter(Boolean)
      .sort((a, b) => b.s - a.s);
    if (scored[0]?.isrc) return normalizeIsrc(scored[0].isrc);
  } catch (e) {
    console.warn("fetchIsrcFromMusicBrainz:", e.message);
  }
  return null;
}

/**
 * Lấy ISRC mạnh: Deezer → iTunes → MusicBrainz.
 * Thử nhiều biến thể tên (bỏ feat/dấu) — tránh lỗi lúc được lúc không.
 */
async function resolveIsrcAggressive({
  songName = "",
  artist = "",
  deezerId = null,
  existingIsrc = null,
  skipMusicBrainz = false,
} = {}) {
  const already = normalizeIsrc(existingIsrc);
  if (already) return already;

  const song = String(songName || "").trim();
  const art = String(artist || "").trim();
  const cleaned = cleanSongTitleForSearch(song);
  const songVariants = [
    ...new Set(
      [song, cleaned, stripDiacritics(song), stripDiacritics(cleaned)].filter(
        (s) => s && s.length >= 2,
      ),
    ),
  ];

  // 1) Deezer — thử từng biến thể tên (feat. hay làm miss)
  for (const s of songVariants.length ? songVariants : [song]) {
    try {
      const dz = await enrichFromDeezer(
        s === song ? deezerId : null,
        s,
        art,
      );
      const fromDz = normalizeIsrc(dz?.isrc);
      if (fromDz) return fromDz;
    } catch (e) {
      console.warn("resolveIsrcAggressive deezer:", e.message);
    }
  }

  // 2) iTunes lookup (US + VN)
  for (const s of songVariants.length ? songVariants : [song]) {
    if (!s) continue;
    for (const country of ["US", "VN"]) {
      try {
        const r = await http.get("https://itunes.apple.com/search", {
          params: {
            term: [s, art].filter(Boolean).join(" "),
            entity: "song",
            limit: 8,
            country,
          },
          timeout: 10000,
        });
        for (const hit of r.data?.results || []) {
          let isrc = normalizeIsrc(hit.isrc);
          if (!isrc && hit.trackId) {
            try {
              const lk = await http.get("https://itunes.apple.com/lookup", {
                params: { id: hit.trackId, country },
                timeout: 8000,
              });
              isrc = normalizeIsrc(lk.data?.results?.[0]?.isrc);
            } catch {
              /* optional */
            }
          }
          if (isrc) return isrc;
        }
      } catch (e) {
        console.warn(`resolveIsrcAggressive itunes-${country}:`, e.message);
      }
    }
  }

  // 3) MusicBrainz — hay 503, chỉ khi không batch hydrate
  if (!skipMusicBrainz) {
    for (const s of songVariants.slice(0, 2)) {
      if (!s) continue;
      try {
        const mb = await fetchIsrcFromMusicBrainz(s, art);
        if (mb) return mb;
      } catch {
        /* ignore */
      }
    }
  }

  return null;
}

/**
 * Hydrate ISRC cho track thiếu (iTunes/Spotify search thường không có ISRC).
 * Deezer /track/{id} + MusicBrainz — tin cậy khi Spotify API 403 Premium.
 */
async function hydrateTrackIsrc(track) {
  if (!track) return track;
  const existing = normalizeIsrc(track.isrc);
  if (existing) return { ...track, isrc: existing };

  const song =
    track.song_title || track.song_name || track.name || track.title || "";
  const artist = track.artist || "";
  if (!song && !track.deezerId && !track.id) return track;

  try {
    let deezerId =
      track.deezerId ||
      (track.source === "deezer-search" && track.id ? String(track.id) : null);

    // Batch search: chỉ Deezer+iTunes (bỏ MusicBrainz — hay 503 làm chậm / miss)
    const isrc = await resolveIsrcAggressive({
      songName: song,
      artist,
      deezerId,
      skipMusicBrainz: true,
    });
    if (isrc) {
      return {
        ...track,
        isrc,
        song_name: track.song_name || song,
        song_title: track.song_title || song,
        artist: track.artist || artist,
        source: `${track.source || "search"}+isrc`,
      };
    }
  } catch (e) {
    console.warn("hydrateTrackIsrc:", e.message);
  }
  return track;
}

/**
 * Tìm nhạc — ưu tiên bài CÓ ISRC (Locket app bắt buộc).
 * Spotify Web API optional (hay 403 Premium) → Deezer (có ISRC) là primary.
 */
async function searchMusicByQuery(query, limit = 30) {
  const q = String(query || "").trim();
  if (!q || q.length < 1) {
    const err = new Error("Nhập tên bài hát để tìm");
    err.status = 400;
    throw err;
  }
  const lim = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const fetchLim = Math.min(50, Math.max(lim, 30));
  const merged = new Map();

  const addTrack = (t, prefer = false) => {
    if (!t) return;
    const key =
      t.isrc ||
      t.spotify_url ||
      t.id ||
      t.deezer_url ||
      t.apple_music_url ||
      `${normalizeSearchText(t.song_title || t.name)}|${normalizeSearchText(t.artist)}`;
    if (!key || key === "|") return;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, t);
      return;
    }
    // Ưu tiên ISRC + platform link (Apple/Spotify) — Locket cần isrc + 1 url
    const score = (x) =>
      (x.isrc ? 4 : 0) +
      (x.apple_music_url ? 3 : 0) +
      (x.spotify_url || x.source === "spotify-search" ? 2 : 0) +
      (x.preview_url ? 1 : 0);
    const next = {
      ...prev,
      ...t,
      isrc: t.isrc || prev.isrc,
      spotify_url: t.spotify_url || prev.spotify_url,
      preview_url: t.preview_url || prev.preview_url,
      apple_music_url: t.apple_music_url || prev.apple_music_url,
      image_url: t.image_url || prev.image_url,
    };
    if (prefer || score(t) >= score(prev)) {
      merged.set(key, next);
    } else {
      merged.set(key, {
        ...prev,
        isrc: prev.isrc || t.isrc,
        preview_url: prev.preview_url || t.preview_url,
        spotify_url: prev.spotify_url || t.spotify_url,
        apple_music_url: prev.apple_music_url || t.apple_music_url,
      });
    }
  };

  // Biến thể query: bỏ dấu / bỏ feat — Deezer trên cloud đôi khi miss Unicode
  const qVariants = [
    ...new Set(
      [
        q,
        cleanSongTitleForSearch(q),
        stripDiacritics(q),
        stripDiacritics(cleanSongTitleForSearch(q)),
      ].filter((s) => s && s.length >= 2),
    ),
  ];

  async function fetchDeezerList(term) {
    try {
      const s = await http.get("https://api.deezer.com/search", {
        params: { q: term, limit: fetchLim },
        timeout: 14000,
      });
      const raw = (s.data?.data || []).slice(0, fetchLim);
      return Promise.all(
        raw.map(async (row) => {
          let t = mapDeezerTrack(row);
          if (t.isrc || !row.id) return t;
          try {
            const detail = await http.get(
              `https://api.deezer.com/track/${row.id}`,
              { timeout: 8000 },
            );
            if (detail.data?.isrc) {
              t = {
                ...t,
                isrc: detail.data.isrc,
                preview_url: t.preview_url || detail.data.preview || null,
              };
            }
          } catch {
            /* keep */
          }
          return t;
        }),
      );
    } catch (e) {
      console.warn("searchMusic deezer:", term, e.message);
      return [];
    }
  }

  // iTunes multi-country (Railway đôi khi chặn Deezer — iTunes + MB vẫn OK)
  async function fetchItunesList(term, country) {
    try {
      const s = await axios.get("https://itunes.apple.com/search", {
        params: {
          term,
          media: "music",
          entity: "song",
          limit: fetchLim,
          country,
        },
        timeout: 12000,
        headers: { "User-Agent": UA },
        validateStatus: (st) => st >= 200 && st < 500,
      });
      if (!s.data?.results) {
        console.warn(
          `searchMusic itunes ${country}: no results body status=${s.status}`,
        );
        return [];
      }
      return (s.data.results || []).map(mapITunesTrack);
    } catch (e) {
      console.warn(`searchMusic itunes ${country}:`, e.message);
      return [];
    }
  }

  // Song song: Spotify (optional) + Deezer (ISRC) + iTunes VN/US
  const [spotifyTracks, deezerNested, itunesVn, itunesUs] = await Promise.all([
    fetchSpotifySearchFull(q, fetchLim).catch((e) => {
      console.warn("searchMusic spotify:", e.message);
      return [];
    }),
    Promise.all(qVariants.slice(0, 3).map((term) => fetchDeezerList(term))),
    Promise.all(
      qVariants.slice(0, 2).map((term) => fetchItunesList(term, "vn")),
    ),
    Promise.all(
      qVariants.slice(0, 2).map((term) => fetchItunesList(term, "us")),
    ),
  ]);

  const deezerTracks = deezerNested.flat();
  const itunesTracks = [...itunesVn.flat(), ...itunesUs.flat()];

  console.log(
    `[searchMusic] "${q.slice(0, 40)}" deezer=${deezerTracks.length} itunes=${itunesTracks.length} spotify=${spotifyTracks.length}`,
  );

  // Merge: ưu tiên khớp score; nếu 0 → vẫn lấy raw (tránh list rỗng trên cloud)
  const keepIfMatch = (t, prefer) => {
    if (!t) return;
    if (scoreTrackMatch(q, t) <= 0) return;
    addTrack(t, prefer);
  };
  for (const t of deezerTracks) keepIfMatch(t, true);
  for (const t of spotifyTracks) keepIfMatch(t, true);
  for (const t of itunesTracks) keepIfMatch(t, true);

  // Filter quá chặt hoặc API cloud miss → soft fallback
  if (merged.size === 0) {
    console.warn(
      `[searchMusic] score/source empty for "${q}" — soft fallback raw`,
    );
    for (const t of [...deezerTracks, ...itunesTracks, ...spotifyTracks].slice(
      0,
      fetchLim,
    )) {
      addTrack(t, true);
    }
  }

  // MusicBrainz recording search — khi Deezer/iTunes đều chết (hay gặp trên Railway)
  if (merged.size === 0) {
    try {
      const mb = await searchMusicBrainzRecordings(q, Math.min(15, fetchLim));
      for (const t of mb) addTrack(t, true);
      console.log(`[searchMusic] musicbrainz fallback: ${mb.length}`);
    } catch (e) {
      console.warn("searchMusic musicbrainz:", e.message);
    }
  }

  let all = [...merged.values()];

  /**
   * Rank: bản gốc + ISRC trước cover; Deezer rank khi không có Spotify API.
   */
  const scored = all
    .map((t) => {
      let s = scoreTrackMatch(q, t);
      if (s <= 0) return { t, s: 0 };
      if (t.isrc) s += 200;
      if (t.source === "spotify-search" || t.spotify_url) {
        s += 80 + Math.min(40, (t.popularity || 0) * 0.3);
      }
      if (
        t.source === "deezer-search" ||
        String(t.source || "").includes("deezer")
      ) {
        s += 100;
      }
      if (
        t.source === "itunes-search" ||
        String(t.source || "").includes("itunes")
      ) {
        s += 50;
      }
      if (t.preview_url) s += 20;
      if (t.apple_music_url) s += 15;
      if (isCoverOrDerivative(t, q)) s -= 800;
      // Title sạch ngắn = bản gốc
      const clean = cleanTrackTitle(t);
      if (clean === normalizeSearchText(q) || clean === q) s += 400;
      return { t, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  let ranked = scored.map((x) => x.t);
  if (scored.length) {
    const topS = scored[0].s;
    const minKeep = Math.max(60, topS * 0.1);
    ranked = scored.filter((x) => x.s >= minKeep).map((x) => x.t);
  }

  if (!ranked.length) ranked = [];

  // Hydrate ISRC top results (Deezer+iTunes) — Locket bắt buộc isrc
  const top = ranked.slice(0, Math.min(lim, 25));
  const needHydrate = top.filter((t) => !normalizeIsrc(t.isrc)).slice(0, 18);
  if (needHydrate.length) {
    // Song song theo batch 6 — tránh flood API
    const hydrated = [];
    for (let i = 0; i < needHydrate.length; i += 6) {
      const chunk = needHydrate.slice(i, i + 6);
      const part = await Promise.all(chunk.map((t) => hydrateTrackIsrc(t)));
      hydrated.push(...part);
    }
    const byKey = new Map(
      hydrated.map((t) => [
        t.id ||
          t.isrc ||
          `${normalizeSearchText(t.song_title || t.name)}|${normalizeSearchText(t.artist)}`,
        t,
      ]),
    );
    ranked = ranked.map((t) => {
      const key =
        t.id ||
        t.isrc ||
        `${normalizeSearchText(t.song_title || t.name)}|${normalizeSearchText(t.artist)}`;
      return byKey.get(key) || t;
    });
  }

  // Bổ sung apple_music_url + preview ổn định (iTunes) — Locket hiện 🍎 Music
  const needApple = ranked
    .slice(0, Math.min(lim, 12))
    .filter((t) => !t.apple_music_url && !t.spotify_url)
    .slice(0, 8);
  if (needApple.length) {
    const filled = await Promise.all(
      needApple.map(async (t) => {
        const song = t.song_title || t.song_name || t.name || "";
        const it = await enrichFromItunes(song, t.artist || "");
        if (!it) return t;
        return {
          ...t,
          isrc: t.isrc || it.isrc || null,
          preview_url: t.preview_url || it.preview_url || null,
          apple_music_url: it.apple_music_url || null,
          image_url: t.image_url || it.image_url || "",
          source: `${t.source || "search"}+apple`,
        };
      }),
    );
    const byId = new Map(
      filled.map((t) => [
        t.id ||
          t.isrc ||
          `${normalizeSearchText(t.song_title || t.name)}|${normalizeSearchText(t.artist)}`,
        t,
      ]),
    );
    ranked = ranked.map((t) => {
      const key =
        t.id ||
        t.isrc ||
        `${normalizeSearchText(t.song_title || t.name)}|${normalizeSearchText(t.artist)}`;
      return byId.get(key) || t;
    });
  }

  // Dedupe theo isrc / title|artist — giữ bản có isrc + platform link
  const deduped = [];
  const seen = new Set();
  for (const t of ranked) {
    const titleKey = normalizeSearchText(
      t.song_title || t.song_name || t.name || "",
    );
    const artistKey = normalizeSearchText(t.artist || "");
    const key = t.isrc
      ? `isrc:${String(t.isrc).toUpperCase()}`
      : `ta:${titleKey}|${artistKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Strip internal fields
    const { _deezerRank, ...clean } = t;
    deduped.push(clean);
  }

  // Ưu tiên: ISRC + platform URL (đăng Locket được) → bản gốc → còn lại
  deduped.sort((a, b) => {
    const score = (t) =>
      (normalizeIsrc(t.isrc) ? 100 : 0) +
      (t.spotify_url || t.apple_music_url ? 40 : 0) +
      (t.preview_url ? 10 : 0) +
      (isCoverOrDerivative(t, q) ? -50 : 20);
    const d = score(b) - score(a);
    if (d !== 0) return d;
    const al = cleanTrackTitle(a).length;
    const bl = cleanTrackTitle(b).length;
    if (al !== bl && Math.abs(al - bl) > 2) return al - bl;
    return 0;
  });

  // Nếu đã có ≥3 bài có ISRC: đẩy bài không ISRC xuống cuối (vẫn giữ để user thấy)
  const withIsrc = deduped.filter((t) => normalizeIsrc(t.isrc));
  const withoutIsrc = deduped.filter((t) => !normalizeIsrc(t.isrc));
  const ordered =
    withIsrc.length >= 3 ? [...withIsrc, ...withoutIsrc] : deduped;

  return ordered.slice(0, lim);
}

module.exports = {
  fetchMusicApi,
  getSpotifyMusicInfo,
  getAppleMusicInfoLocal,
  extractSpotifyTrackId,
  expandSpotifyShortUrl,
  searchMusicByQuery,
  getSpotifyAppToken,
  hydrateTrackIsrc,
  resolveIsrcAggressive,
  normalizeIsrc,
  isValidIsrc,
  normalizeAppleMusicUrl,
  isPlayableAppleMusicUrl,
  isStablePreviewUrl,
  isStableCoverUrl,
  enrichFromItunes,
  fetchSongLink,
};
