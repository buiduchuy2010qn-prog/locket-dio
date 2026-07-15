import api from "@/libs/axios";

export const getInfoMusicByUrl = async (url, platform) => {
  if (!url || !platform) {
    console.warn("⚠️ getInfoMusicByUrl: Thiếu url hoặc platform");
    return null;
  }

  try {
    const res = await api.post(
      "/api/getInfoMusicV2",
      { url, platform },
      {
        timeout: 60000, // chấp nhận chậm — cần ISRC cho Locket
        // Không spam toast 404 khi resolve multi-step
        skipErrorToast: true,
      },
    );

    if (res?.data?.status === "success") {
      return res.data.data;
    }

    console.error("❌ getInfoMusicByUrl: Không có dữ liệu hợp lệ", res?.data);
    return null;
  } catch (error) {
    console.error(
      "🚨 Lỗi khi gọi getInfoMusicByUrl:",
      error?.response?.data?.message || error.message,
    );
    return null;
  }
};

/** Chuẩn hoá ISRC 12 ký tự — app Locket bắt buộc */
export function normalizeIsrc(raw) {
  if (!raw) return null;
  const s = String(raw)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(s)) return s;
  if (/^[A-Z0-9]{12}$/.test(s)) return s;
  return null;
}

/**
 * Resolve meta + ISRC cho Locket — nhiều bước, chấp nhận lâu.
 * Locket app cần isrc; Spotify Web API hay 403 → ưu tiên search (Deezer ISRC).
 */
export const resolveMusicForLocket = async (track = {}) => {
  const song =
    track.song_title ||
    track.song_name ||
    track.title ||
    track.name ||
    "";
  const artist = track.artist || "";
  let spotify_url =
    track.spotify_url ||
    (track.id &&
    typeof track.id === "string" &&
    /^[a-zA-Z0-9]{10,}$/.test(track.id) &&
    !String(track.source || "").includes("deezer") &&
    !String(track.source || "").includes("itunes")
      ? `https://open.spotify.com/track/${track.id}`
      : null);
  let apple_music_url = track.apple_music_url || track.appleMusicUrl || null;
  const knownIsrc = normalizeIsrc(track.isrc);

  const baseShape = (extra = {}) => ({
    song_title: song,
    song_name: song,
    name: song,
    artist,
    preview_url: track.preview_url || track.audioUrl || null,
    image_url: track.image_url || track.coverUrl || "",
    spotify_url,
    apple_music_url,
    platform: spotify_url ? "spotify" : apple_music_url ? "apple" : "spotify",
    ...extra,
  });

  // Đã có ISRC + platform URL — gắn ngay
  if (knownIsrc && (spotify_url || apple_music_url)) {
    return baseShape({
      isrc: knownIsrc,
      song_title:
        track.song_title || track.song_name || track.title || track.name || song,
      song_name:
        track.song_name || track.song_title || track.title || track.name || song,
      name:
        track.name || track.song_title || track.song_name || track.title || song,
      artist: track.artist || artist,
      preview_url:
        track.preview_url || track.audioUrl || track.audio || null,
      image_url: track.image_url || track.coverUrl || "",
      spotify_url,
      apple_music_url,
    });
  }

  // 1) Theo link Spotify (oEmbed + Deezer ISRC trên server)
  if (spotify_url) {
    const info = await getInfoMusicByUrl(spotify_url, "spotify");
    const infoIsrc = normalizeIsrc(info?.isrc) || knownIsrc;
    if (info && infoIsrc) {
      return {
        ...info,
        isrc: infoIsrc,
        spotify_url: info.spotify_url || spotify_url,
        apple_music_url: info.apple_music_url || apple_music_url || null,
      };
    }
    if (info && !infoIsrc) {
      const q = [info.song_title || info.song_name || song, info.artist || artist]
        .filter(Boolean)
        .join(" ");
      if (q) {
        try {
          const hits = await searchMusicByQuery(q, 20);
          const withIsrc = (hits || []).find((h) => normalizeIsrc(h.isrc));
          if (withIsrc) {
            return {
              ...info,
              isrc: normalizeIsrc(withIsrc.isrc),
              preview_url:
                info.preview_url || withIsrc.preview_url || null,
              image_url: info.image_url || withIsrc.image_url || "",
              spotify_url:
                info.spotify_url || withIsrc.spotify_url || spotify_url,
              apple_music_url:
                info.apple_music_url ||
                withIsrc.apple_music_url ||
                apple_music_url ||
                null,
            };
          }
        } catch {
          /* continue */
        }
      }
    }
  }

  // 1b) Apple Music link — lấy meta; ISRC có thể thiếu → search bù
  let appleMeta = null;
  if (apple_music_url && !knownIsrc) {
    const info = await getInfoMusicByUrl(apple_music_url, "apple");
    const infoIsrc = normalizeIsrc(info?.isrc);
    if (info && infoIsrc) {
      return {
        ...info,
        isrc: infoIsrc,
        apple_music_url: info.apple_music_url || apple_music_url,
        spotify_url: info.spotify_url || spotify_url || null,
      };
    }
    if (info) appleMeta = info;
  }

  // 2) Search theo tên (+ biến thể bỏ feat/dấu) — ưu tiên hit có ISRC
  const songClean = String(song || appleMeta?.song_title || appleMeta?.song_name || "")
    .replace(/\(.*?\)/g, " ")
    .replace(/\[.*?\]/g, " ")
    .replace(/\b(feat\.?|ft\.?|featuring|with)\s+.+$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  const artistUse = artist || appleMeta?.artist || "";
  const qList = [
    ...new Set(
      [
        [song, artistUse].filter(Boolean).join(" ").trim(),
        [songClean, artistUse].filter(Boolean).join(" ").trim(),
        songClean,
        song,
      ].filter((s) => s && s.length >= 2),
    ),
  ];
  if (!qList.length && !knownIsrc) return null;

  try {
    for (const q of qList) {
      const hits = await searchMusicByQuery(q, 25);
      const withIsrc =
        (hits || []).find(
          (h) =>
            normalizeIsrc(h.isrc) && (h.spotify_url || h.apple_music_url),
        ) || (hits || []).find((h) => normalizeIsrc(h.isrc));
      if (withIsrc) {
        return {
          song_title:
            withIsrc.song_title ||
            withIsrc.song_name ||
            appleMeta?.song_title ||
            song,
          song_name:
            withIsrc.song_name ||
            withIsrc.song_title ||
            appleMeta?.song_name ||
            song,
          name: withIsrc.name || withIsrc.song_title || song,
          artist: withIsrc.artist || artistUse,
          isrc: normalizeIsrc(withIsrc.isrc) || knownIsrc,
          preview_url:
            withIsrc.preview_url ||
            track.preview_url ||
            appleMeta?.preview_url ||
            null,
          image_url:
            withIsrc.image_url ||
            track.image_url ||
            track.coverUrl ||
            appleMeta?.image_url ||
            "",
          spotify_url: withIsrc.spotify_url || spotify_url || null,
          apple_music_url:
            withIsrc.apple_music_url ||
            apple_music_url ||
            appleMeta?.apple_music_url ||
            null,
          platform: withIsrc.spotify_url ? "spotify" : "apple",
        };
      }
    }

    // 3–4) getInfo từng hit (chậm) — query đầu
    const hits = qList[0] ? await searchMusicByQuery(qList[0], 15) : [];
    for (const h of hits || []) {
      const u = h.spotify_url;
      if (!u) continue;
      const info = await getInfoMusicByUrl(u, "spotify");
      if (normalizeIsrc(info?.isrc)) {
        return { ...info, isrc: normalizeIsrc(info.isrc) };
      }
    }
    for (const h of hits || []) {
      if (h.apple_music_url) {
        const info = await getInfoMusicByUrl(h.apple_music_url, "apple");
        if (normalizeIsrc(info?.isrc)) {
          return { ...info, isrc: normalizeIsrc(info.isrc) };
        }
      }
    }
  } catch (e) {
    console.error("[resolveMusicForLocket] search:", e.message);
  }

  // 5) Spotify user token — bù spotify_url (Android) khi server thiếu client secret
  try {
    const localId =
      localStorage.getItem("localId") ||
      sessionStorage.getItem("localId") ||
      "guest";
    const { isSpotifyUserLinked, searchSpotifyTracks } = await import(
      "@/services/ExtensionsServices/SpotifyUserServices"
    );
    if (isSpotifyUserLinked(localId) && (song || artist)) {
      const hits = await searchSpotifyTracks(
        localId,
        [song, artist].filter(Boolean).join(" "),
        8,
      );
      const hit =
        (hits || []).find(
          (h) =>
            normalizeIsrc(h.isrc) &&
            (normalizeIsrc(h.isrc) === knownIsrc || !knownIsrc),
        ) ||
        (hits || []).find((h) => h.spotify_url) ||
        null;
      if (hit) {
        return {
          song_title: hit.song_title || song,
          song_name: hit.song_name || song,
          name: hit.name || song,
          artist: hit.artist || artist,
          isrc: normalizeIsrc(hit.isrc) || knownIsrc,
          preview_url: hit.preview_url || track.preview_url || null,
          image_url: hit.image_url || track.image_url || track.coverUrl || "",
          spotify_url: hit.spotify_url || spotify_url || null,
          apple_music_url: apple_music_url || hit.apple_music_url || null,
          platform: "spotify",
        };
      }
    }
  } catch {
    /* optional */
  }

  // Còn ISRC sẵn nhưng thiếu platform URL — trả partial
  if (knownIsrc) {
    return baseShape({ isrc: knownIsrc });
  }

  return null;
};

/** Bỏ dấu VN để so khớp tựa */
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

/** Word boundary — tránh "tim"∈"time", "em"∈"remember" */
function tokenAsWord(token, text) {
  if (!token || !text) return false;
  const t = escapeRegExp(token);
  if (new RegExp(`(?:^|\\s)${t}(?:\\s|$)`).test(text)) return true;
  if (token.length >= 5 && new RegExp(`(?:^|\\s)${t}`).test(text)) return true;
  return false;
}

/**
 * Soft re-rank client — ưu tiên isrc (Locket) + spotify_url.
 */
function rankTracksByQuery(query, tracks, limit = 40) {
  const q = normalizeSearchText(query);
  if (!q || !Array.isArray(tracks) || !tracks.length) return tracks || [];

  const tokens = q.split(" ").filter(Boolean);

  const scored = tracks.map((track) => {
    const title = normalizeSearchText(
      track.song_title || track.song_name || track.name || track.title || "",
    );
    const artistN = normalizeSearchText(track.artist || "");
    const full = `${title} ${artistN}`.trim();

    const inTitle = tokens.filter((t) => tokenAsWord(t, title));
    const inArtist = tokens.filter((t) => tokenAsWord(t, artistN));
    const inFull = tokens.filter((t) => tokenAsWord(t, full));
    const joined = tokens.join(" ");
    const phrase = title.includes(q) || title === q;
    const phraseArtist =
      artistN &&
      (artistN === q || artistN.includes(q) || artistN.startsWith(q));
    const allInArtist =
      artistN &&
      tokens.every(
        (tok) => tokenAsWord(tok, artistN) || artistN.includes(joined),
      );

    // Soft score — server đã lọc; không loại 0 hẳn (giữ artist hits)
    let s = 5;
    if (title === q) s += 5000;
    else if (title.startsWith(q)) s += 2500;
    if (phrase) s += 1500;
    if (tokens.length > 1 && title.includes(joined)) s += 1200;
    s += (inTitle.length / Math.max(1, tokens.length)) * 800;
    s += (inFull.length / Math.max(1, tokens.length)) * 100;

    if (artistN === q) s += 7000;
    else if (phraseArtist) s += 5500;
    else if (allInArtist) s += 4500;
    s += (inArtist.length / Math.max(1, tokens.length)) * 900;

    if (track.isrc) s += 120;
    if (track.spotify_url || track.source === "spotify-search") s += 40;
    if (track.apple_music_url) s += 20;
    // Cover/karaoke không nên đứng trước bản gốc khi gắn Locket
    const blob = `${title} ${artistN}`;
    if (
      /\b(cover|piano|karaoke|tribute|rendition|instrumental|nightcore|ringtone|parody|quartet)\b/.test(
        blob,
      )
    ) {
      s *= 0.2;
    }
    if (typeof track.popularity === "number") {
      s += Math.min(40, track.popularity * 0.25);
    }
    return { track, s };
  });

  return scored
    .sort((a, b) => {
      if (b.s !== a.s) return b.s - a.s;
      const ai = a.track.isrc ? 1 : 0;
      const bi = b.track.isrc ? 1 : 0;
      return bi - ai;
    })
    .map((x) => x.track)
    .slice(0, limit);
}

/** iTunes Search API — CORS mở, fallback khi server/API lỗi */
async function searchItunesClient(query, limit = 25) {
  const term = String(query || "").trim();
  if (!term) return [];
  try {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", term);
    url.searchParams.set("media", "music");
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", String(Math.min(50, limit)));
    url.searchParams.set("country", "vn");
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results || []).map((t) => {
      let apple = t.trackViewUrl || null;
      try {
        if (apple) {
          const u = new URL(apple);
          const i = u.searchParams.get("i");
          apple = `https://music.apple.com${u.pathname}${i ? `?i=${i}` : ""}`;
        }
      } catch {
        /* keep */
      }
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
        apple_music_url: apple,
        duration_ms: t.trackTimeMillis || 0,
        platform: "apple",
        source: "itunes-client",
        title: [t.trackName, t.artistName].filter(Boolean).join(" - "),
      };
    });
  } catch (e) {
    console.warn("searchItunesClient:", e.message);
    return [];
  }
}

/** Deezer public search — CORS thường mở */
async function searchDeezerClient(query, limit = 25) {
  const term = String(query || "").trim();
  if (!term) return [];
  try {
    const url = new URL("https://api.deezer.com/search");
    url.searchParams.set("q", term);
    url.searchParams.set("limit", String(Math.min(50, limit)));
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data || []).map((t) => ({
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
      platform: "deezer",
      source: "deezer-client",
      title: [t.title, t.artist?.name].filter(Boolean).join(" - "),
    }));
  } catch (e) {
    console.warn("searchDeezerClient:", e.message);
    return [];
  }
}

function mergeTrackLists(...lists) {
  const merged = new Map();
  const score = (x) =>
    (normalizeIsrc(x?.isrc) ? 4 : 0) +
    (x?.spotify_url ? 3 : 0) +
    (x?.apple_music_url ? 2 : 0) +
    (x?.preview_url ? 1 : 0);
  for (const list of lists) {
    for (const t of list || []) {
      if (!t) continue;
      const key =
        normalizeIsrc(t.isrc) ||
        t.spotify_url ||
        t.id ||
        t.deezer_url ||
        t.apple_music_url ||
        `${normalizeSearchText(t.song_title || t.name)}|${normalizeSearchText(t.artist)}`;
      if (!key || key === "|") continue;
      const prev = merged.get(key);
      if (!prev) {
        merged.set(key, t);
        continue;
      }
      merged.set(key, {
        ...prev,
        ...t,
        isrc: normalizeIsrc(t.isrc) || normalizeIsrc(prev.isrc) || null,
        spotify_url: t.spotify_url || prev.spotify_url || null,
        apple_music_url: t.apple_music_url || prev.apple_music_url || null,
        preview_url: t.preview_url || prev.preview_url || null,
        image_url: t.image_url || prev.image_url || "",
        song_title:
          t.song_title || t.song_name || prev.song_title || prev.song_name || "",
        artist: t.artist || prev.artist || "",
      });
      // Prefer richer track
      if (score(t) < score(prev)) {
        merged.set(key, {
          ...t,
          ...prev,
          isrc: normalizeIsrc(prev.isrc) || normalizeIsrc(t.isrc) || null,
          spotify_url: prev.spotify_url || t.spotify_url || null,
          apple_music_url: prev.apple_music_url || t.apple_music_url || null,
          preview_url: prev.preview_url || t.preview_url || null,
          image_url: prev.image_url || t.image_url || "",
        });
      }
    }
  }
  return [...merged.values()];
}

/** Tìm nhạc theo tên — server (Deezer/iTunes/Spotify) + fallback client + Spotify user */
export const searchMusicByQuery = async (query, limit = 30) => {
  const q = String(query || "").trim();
  if (!q) return [];
  const fetchLimit = Math.min(50, Math.max(Number(limit) || 30, 25));
  let serverList = [];
  let serverError = null;

  try {
    const res = await api.post(
      "/api/searchMusic",
      { query: q, limit: fetchLimit },
      { timeout: 45000, skipErrorToast: true },
    );
    if (res?.data?.status === "success" && Array.isArray(res.data.data)) {
      serverList = res.data.data;
    } else if (Array.isArray(res?.data)) {
      serverList = res.data;
    } else if (Array.isArray(res?.data?.data)) {
      serverList = res.data.data;
    }
  } catch (error) {
    serverError = error;
    console.error("🚨 searchMusicByQuery server:", error?.message || error);
  }

  // Spotify user token (nếu đã liên kết) — bù spotify_url cho Android
  let userSpotify = [];
  try {
    const localId =
      localStorage.getItem("localId") ||
      sessionStorage.getItem("localId") ||
      "guest";
    const { isSpotifyUserLinked, searchSpotifyTracks } = await import(
      "@/services/ExtensionsServices/SpotifyUserServices"
    );
    if (isSpotifyUserLinked(localId)) {
      userSpotify = await searchSpotifyTracks(localId, q, Math.min(20, fetchLimit));
    }
  } catch {
    /* optional */
  }

  // Fallback iTunes + Deezer khi server rỗng / lỗi
  let clientFallback = [];
  if (!serverList.length) {
    const [it, dz] = await Promise.all([
      searchItunesClient(q, fetchLimit),
      searchDeezerClient(q, fetchLimit),
    ]);
    clientFallback = [...dz, ...it];
  }

  const merged = mergeTrackLists(serverList, userSpotify, clientFallback);
  if (!merged.length) {
    if (serverError) {
      const err = new Error(
        serverError?.response?.data?.message ||
          serverError?.message ||
          "Không tìm được nhạc — kiểm tra mạng / đăng nhập lại",
      );
      err.cause = serverError;
      throw err;
    }
    return [];
  }

  const ranked = rankTracksByQuery(q, merged, fetchLimit);
  const out = ranked.length ? ranked : merged;
  out.sort((a, b) => {
    const sa =
      (normalizeIsrc(a.isrc) ? 4 : 0) +
      (a.spotify_url ? 2 : 0) +
      (a.apple_music_url ? 2 : 0) +
      (a.preview_url ? 1 : 0);
    const sb =
      (normalizeIsrc(b.isrc) ? 4 : 0) +
      (b.spotify_url ? 2 : 0) +
      (b.apple_music_url ? 2 : 0) +
      (b.preview_url ? 1 : 0);
    return sb - sa;
  });
  return out.slice(0, fetchLimit);
};
