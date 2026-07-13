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
    const artist = normalizeSearchText(track.artist || "");
    const full = `${title} ${artist}`;
    if (!title) return { track, s: 1 };

    const inTitle = tokens.filter((t) => tokenAsWord(t, title));
    const inFull = tokens.filter((t) => tokenAsWord(t, full));
    const phrase = title.includes(q) || title === q;

    // Bắt buộc khớp query — không boost ISRC cho bài rác
    if (!phrase && inTitle.length === 0 && tokens.length >= 1) {
      // token ngắn: không cho substring (tim∈time)
      const allShortInTitle = tokens.every((tok) => tokenAsWord(tok, title));
      if (!allShortInTitle && !title.includes(tokens.join(" "))) {
        return { track, s: 0 };
      }
    }

    let s = 10;
    if (title === q) s += 5000;
    else if (title.startsWith(q)) s += 2500;
    if (phrase) s += 1500;
    if (tokens.length > 1 && title.includes(tokens.join(" "))) s += 1200;
    s += (inTitle.length / Math.max(1, tokens.length)) * 800;
    s += (inFull.length / Math.max(1, tokens.length)) * 100;
    if (track.isrc && s > 10) s += 200;
    if (
      (track.spotify_url || track.source === "spotify-search") &&
      s > 10
    ) {
      s += 100;
    }
    if (typeof track.popularity === "number" && s > 50) {
      s += Math.min(50, track.popularity * 0.3);
    }
    return { track, s };
  });

  const kept = scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.track);

  if (!kept.length) return tracks.slice(0, limit);
  return kept.slice(0, limit);
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
      const ranked = rankTracksByQuery(q, list, fetchLimit);
      const out = ranked.length ? ranked : list;
      // ISRC trước, rồi spotify_url
      out.sort((a, b) => {
        const ai = a.isrc ? 1 : 0;
        const bi = b.isrc ? 1 : 0;
        if (bi !== ai) return bi - ai;
        const as = a.spotify_url || a.source === "spotify-search" ? 1 : 0;
        const bs = b.spotify_url || b.source === "spotify-search" ? 1 : 0;
        return bs - as;
      });
      return out.slice(0, fetchLimit);
    }
    return [];
  } catch (error) {
    console.error("🚨 searchMusicByQuery:", error.message);
    throw error;
  }
};
