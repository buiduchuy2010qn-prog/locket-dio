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

/** Fallback iTunes từ browser khi API Railway trả rỗng (Deezer chặn) */
async function searchItunesBrowser(query, limit = 25) {
  const q = String(query || "").trim();
  if (!q) return [];
  const out = [];
  const seen = new Set();
  for (const country of ["vn", "us"]) {
    try {
      const url = new URL("https://itunes.apple.com/search");
      url.searchParams.set("term", q);
      url.searchParams.set("media", "music");
      url.searchParams.set("entity", "song");
      url.searchParams.set("limit", String(Math.min(25, limit)));
      url.searchParams.set("country", country);
      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();
      for (const r of data?.results || []) {
        if (!r.trackName) continue;
        const id = String(r.trackId || "");
        if (id && seen.has(id)) continue;
        if (id) seen.add(id);
        let apple = r.trackViewUrl || null;
        try {
          if (apple) {
            const u = new URL(apple);
            const i = u.searchParams.get("i") || id;
            apple = `https://music.apple.com${u.pathname}${i ? `?i=${i}` : ""}`;
          }
        } catch {
          /* keep */
        }
        out.push({
          id: id || `it-${out.length}`,
          song_title: r.trackName,
          song_name: r.trackName,
          name: r.trackName,
          artist: r.artistName || "",
          image_url: (r.artworkUrl100 || "").replace("100x100", "600x600") || "",
          preview_url: r.previewUrl || null,
          isrc: null,
          spotify_url: null,
          apple_music_url: apple,
          platform: "apple",
          source: "itunes-browser",
          title: [r.trackName, r.artistName].filter(Boolean).join(" - "),
        });
      }
    } catch (e) {
      console.warn("[searchItunesBrowser]", e.message);
    }
  }
  return out.slice(0, limit);
}

/** Tìm nhạc — API server + fallback iTunes browser (bản ~8:40 PM + fix Railway) */
export const searchMusicByQuery = async (query, limit = 30) => {
  const q = String(query || "").trim();
  if (!q) return [];
  const fetchLimit = Math.min(50, Math.max(Number(limit) || 30, 25));
  let list = [];
  try {
    const res = await api.post(
      "/api/searchMusic",
      { query: q, limit: fetchLimit },
      { timeout: 45000, skipErrorToast: true },
    );
    if (res?.data?.status === "success" && Array.isArray(res.data.data)) {
      list = res.data.data;
    } else if (Array.isArray(res?.data)) {
      list = res.data;
    } else if (Array.isArray(res?.data?.data)) {
      list = res.data.data;
    }
  } catch (error) {
    console.error("🚨 searchMusicByQuery server:", error.message);
  }

  if (!list.length) {
    list = await searchItunesBrowser(q, fetchLimit);
  }
  if (!list.length) return [];

  const ranked = rankTracksByQuery(q, list, fetchLimit);
  const out = ranked.length ? ranked : list;
  out.sort((a, b) => {
    const sa =
      (a.isrc ? 2 : 0) +
      (a.spotify_url || a.source === "spotify-search" ? 1 : 0) +
      (a.apple_music_url ? 1 : 0);
    const sb =
      (b.isrc ? 2 : 0) +
      (b.spotify_url || b.source === "spotify-search" ? 1 : 0) +
      (b.apple_music_url ? 1 : 0);
    if (sa !== sb) return sb - sa;
    return 0;
  });
  return out.slice(0, fetchLimit);
};
