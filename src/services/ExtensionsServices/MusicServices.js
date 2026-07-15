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

/** iOS MusicKit — cần music.apple.com/...?...i=trackId */
export function isPlayableAppleMusicUrl(url = "") {
  const s = String(url || "").trim();
  if (!s || !/music\.apple\.com|itunes\.apple\.com/i.test(s)) return false;
  if (!/[?&]i=\d{5,}/.test(s)) return false;
  if (/\/album\/_\//i.test(s)) return false;
  return true;
}

/**
 * Browser iTunes Search (CORS OK) — bù Apple ?i= khi search list thiếu.
 * Không cần dán link: tìm tên bài trên web là đủ.
 */
export async function lookupItunesForLocket(song = "", artist = "") {
  const title = String(song || "").trim();
  if (!title) return null;
  const artistL = String(artist || "").toLowerCase();
  const nameL = title.toLowerCase();
  const term = [title, artist].filter(Boolean).join(" ");

  for (const country of ["vn", "us"]) {
    try {
      const url = new URL("https://itunes.apple.com/search");
      url.searchParams.set("term", term);
      url.searchParams.set("media", "music");
      url.searchParams.set("entity", "song");
      url.searchParams.set("limit", "8");
      url.searchParams.set("country", country);
      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();
      const hits = data?.results || [];
      if (!hits.length) continue;

      const best =
        hits.find(
          (t) =>
            t.trackName?.toLowerCase() === nameL ||
            (t.trackName?.toLowerCase().includes(nameL.slice(0, 12)) &&
              (!artistL ||
                t.artistName?.toLowerCase().includes(artistL.slice(0, 8)))),
        ) || hits[0];

      let isrc = best.isrc || null;
      if (best.trackId) {
        try {
          const lk = new URL("https://itunes.apple.com/lookup");
          lk.searchParams.set("id", String(best.trackId));
          lk.searchParams.set("country", country);
          const lr = await fetch(lk.toString());
          if (lr.ok) {
            const ld = await lr.json();
            isrc = ld?.results?.[0]?.isrc || isrc;
          }
        } catch {
          /* optional */
        }
      }

      const trackId = String(best.trackId || "").replace(/\D/g, "");
      let apple =
        best.trackViewUrl ||
        (trackId
          ? `https://music.apple.com/${country}/song/${trackId}?i=${trackId}`
          : null);
      // Chuẩn hoá path + ?i=
      if (apple) {
        try {
          const u = new URL(apple);
          const i =
            u.searchParams.get("i") ||
            trackId ||
            "";
          if (i) {
            apple = `https://music.apple.com${u.pathname}?i=${i}`;
          }
        } catch {
          /* keep */
        }
      }
      if (!isPlayableAppleMusicUrl(apple) && trackId.length >= 5) {
        apple = `https://music.apple.com/${country}/song/${trackId}?i=${trackId}`;
      }
      if (!isPlayableAppleMusicUrl(apple)) continue;

      return {
        song_title: best.trackName || title,
        song_name: best.trackName || title,
        name: best.trackName || title,
        artist: best.artistName || artist,
        isrc: normalizeIsrc(isrc),
        preview_url: best.previewUrl || null,
        image_url: (best.artworkUrl100 || "").replace("100x100", "600x600"),
        apple_music_url: apple,
        source: `itunes-browser-${country}`,
      };
    } catch (e) {
      console.warn(`[lookupItunes] ${country}:`, e.message);
    }
  }
  return null;
}

/**
 * Sau search/pick: đảm bảo có Apple ?i= (iPhone) — không bắt user dán link.
 */
export async function ensureIosAppleOnTrack(track = {}) {
  if (!track || typeof track !== "object") return track;
  let out = { ...track };
  if (isPlayableAppleMusicUrl(out.apple_music_url || out.appleMusicUrl)) {
    out.apple_music_url = out.apple_music_url || out.appleMusicUrl;
    return out;
  }
  const song =
    out.song_title || out.song_name || out.title || out.name || "";
  const artist = out.artist || "";
  const it = await lookupItunesForLocket(song, artist);
  if (it?.apple_music_url) {
    out = {
      ...out,
      apple_music_url: it.apple_music_url,
      preview_url: out.preview_url || it.preview_url || null,
      image_url: out.image_url || it.image_url || "",
      isrc: normalizeIsrc(out.isrc) || it.isrc || null,
      song_title: out.song_title || it.song_title || song,
      artist: out.artist || it.artist || artist,
    };
  }
  return out;
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

  // Đã có ISRC + platform URL — vẫn bù Apple ?i= nếu thiếu (iPhone)
  if (knownIsrc && (spotify_url || apple_music_url)) {
    let shaped = baseShape({
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
    if (!isPlayableAppleMusicUrl(shaped.apple_music_url)) {
      shaped = await ensureIosAppleOnTrack(shaped);
    }
    return shaped;
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

  // Còn ISRC sẵn nhưng thiếu platform URL — bù iTunes rồi trả
  if (knownIsrc) {
    let partial = baseShape({ isrc: knownIsrc });
    if (!isPlayableAppleMusicUrl(partial.apple_music_url)) {
      partial = await ensureIosAppleOnTrack(partial);
    }
    return partial;
  }

  // Last resort: chỉ có tên → iTunes browser
  if (song) {
    const it = await lookupItunesForLocket(song, artist);
    if (it && (normalizeIsrc(it.isrc) || it.apple_music_url)) {
      return {
        ...baseShape(),
        ...it,
        isrc: normalizeIsrc(it.isrc),
        spotify_url: spotify_url || null,
        apple_music_url: it.apple_music_url,
      };
    }
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

/** Tìm nhạc theo tên — full catalog qua API server (Deezer ISRC + iTunes + Spotify) */
export const searchMusicByQuery = async (query, limit = 30) => {
  const q = String(query || "").trim();
  if (!q) return [];
  try {
    const fetchLimit = Math.min(50, Math.max(Number(limit) || 30, 25));
    const res = await api.post(
      "/api/searchMusic",
      { query: q, limit: fetchLimit },
      { timeout: 45000, skipErrorToast: true },
    );
    if (res?.data?.status === "success" && Array.isArray(res.data.data)) {
      const list = res.data.data;
      // Soft re-rank — giữ list server nếu filter rỗng (tìm artist)
      const ranked = rankTracksByQuery(q, list, fetchLimit);
      const out = ranked.length ? ranked : list;
      // Tie-break: isrc / spotify — không phá thứ tự khớp
      out.sort((a, b) => {
        const sa =
          (a.isrc ? 2 : 0) +
          (a.spotify_url || a.source === "spotify-search" ? 1 : 0);
        const sb =
          (b.isrc ? 2 : 0) +
          (b.spotify_url || b.source === "spotify-search" ? 1 : 0);
        // Chỉ swap khi điểm phụ chênh và cùng “nhóm” gần nhau
        if (sa !== sb) return sb - sa;
        return 0;
      });
      return out.slice(0, fetchLimit);
    }
    // Một số proxy trả data thuần array
    if (Array.isArray(res?.data)) return res.data.slice(0, fetchLimit);
    if (Array.isArray(res?.data?.data)) return res.data.data.slice(0, fetchLimit);
    return [];
  } catch (error) {
    console.error("🚨 searchMusicByQuery:", error.message);
    throw error;
  }
};
