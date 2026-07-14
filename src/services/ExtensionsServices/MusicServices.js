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

  const baseShape = (extra = {}) => ({
    song_title: song,
    song_name: song,
    name: song,
    artist,
    preview_url: track.preview_url || track.audioUrl || null,
    image_url: track.image_url || track.coverUrl || "",
    spotify_url,
    apple_music_url: track.apple_music_url || null,
    platform: "spotify",
    ...extra,
  });

  // Đã có ISRC — gắn ngay (nhanh nhất)
  if (track.isrc) {
    return baseShape({
      isrc: String(track.isrc).trim(),
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
      apple_music_url: track.apple_music_url || null,
    });
  }

  // 1) Theo link Spotify (oEmbed + Deezer ISRC trên server)
  if (spotify_url) {
    const info = await getInfoMusicByUrl(spotify_url, "spotify");
    if (info?.isrc) return info;
    if (info && !info.isrc) {
      const q = [info.song_title || info.song_name || song, info.artist || artist]
        .filter(Boolean)
        .join(" ");
      if (q) {
        try {
          const hits = await searchMusicByQuery(q, 20);
          const withIsrc = (hits || []).find((h) => h.isrc);
          if (withIsrc?.isrc) {
            return {
              ...info,
              isrc: String(withIsrc.isrc).trim(),
              preview_url:
                info.preview_url || withIsrc.preview_url || null,
              image_url: info.image_url || withIsrc.image_url || "",
              spotify_url:
                info.spotify_url || withIsrc.spotify_url || spotify_url,
              apple_music_url:
                info.apple_music_url || withIsrc.apple_music_url || null,
            };
          }
        } catch {
          /* continue */
        }
      }
      // Có meta, thiếu isrc — caller có thể reject
      return info;
    }
  }

  // 2) Search theo tên + nghệ sĩ — ưu tiên hit có ISRC (Deezer)
  const q = [song, artist].filter(Boolean).join(" ").trim();
  if (!q) return null;

  try {
    const hits = await searchMusicByQuery(q, 25);
    const withIsrc = (hits || []).find((h) => h.isrc);
    if (withIsrc?.isrc) {
      return {
        song_title: withIsrc.song_title || withIsrc.song_name || song,
        song_name: withIsrc.song_name || withIsrc.song_title || song,
        name: withIsrc.name || withIsrc.song_title || song,
        artist: withIsrc.artist || artist,
        isrc: String(withIsrc.isrc).trim(),
        preview_url: withIsrc.preview_url || track.preview_url || null,
        image_url:
          withIsrc.image_url || track.image_url || track.coverUrl || "",
        spotify_url: withIsrc.spotify_url || spotify_url || null,
        apple_music_url: withIsrc.apple_music_url || null,
        platform: "spotify",
      };
    }

    // 3) getInfo từng Spotify hit (chậm)
    for (const h of hits || []) {
      const u = h.spotify_url;
      if (!u) continue;
      const info = await getInfoMusicByUrl(u, "spotify");
      if (info?.isrc) return info;
    }

    // 4) Apple Music link nếu có
    for (const h of hits || []) {
      if (h.apple_music_url) {
        const info = await getInfoMusicByUrl(h.apple_music_url, "apple");
        if (info?.isrc) return info;
      }
    }
  } catch (e) {
    console.error("[resolveMusicForLocket] search:", e.message);
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
