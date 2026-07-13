import api from "@/libs/axios";

export const getInfoMusicByUrl = async (url, platform) => {
  if (!url || !platform) {
    console.warn("⚠️ getInfoMusicByUrl: Thiếu url hoặc platform");
    return null;
  }

  try {
    const res = await api.post("/api/getInfoMusicV2", { url, platform });

    if (res?.data?.status === "success") {
      return res.data.data;
    }

    console.error("❌ getInfoMusicByUrl: Không có dữ liệu hợp lệ", res?.data);
    return null;
  } catch (error) {
    console.error("🚨 Lỗi khi gọi getInfoMusicByUrl:", error.message);
    return null;
  }
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
 * Soft re-rank client — KHÔNG cắt gắt Spotify results.
 * Giữ gần như full list server; chỉ ưu tiên match + spotify_url.
 */
function rankTracksByQuery(query, tracks, limit = 40) {
  const q = normalizeSearchText(query);
  if (!q || !Array.isArray(tracks) || !tracks.length) return tracks || [];

  const tokens = q.split(" ").filter(Boolean);

  const scored = tracks.map((track) => {
    const title = normalizeSearchText(
      track.song_title || track.song_name || track.name || "",
    );
    const artist = normalizeSearchText(track.artist || "");
    const full = `${title} ${artist}`;
    if (!title) return { track, s: 1 };

    const inTitle = tokens.filter((t) => tokenAsWord(t, title));
    const inFull = tokens.filter((t) => tokenAsWord(t, full));
    const phrase = title.includes(q) || title === q;

    let s = 10; // base — keep almost all Spotify hits
    if (title === q) s += 5000;
    else if (title.startsWith(q)) s += 2500;
    if (phrase) s += 1500;
    if (tokens.length > 1 && title.includes(tokens.join(" "))) s += 1200;
    s += (inTitle.length / Math.max(1, tokens.length)) * 800;
    s += (inFull.length / Math.max(1, tokens.length)) * 100;
    if (track.spotify_url || track.source === "spotify-search") s += 300;
    if (typeof track.popularity === "number") s += Math.min(50, track.popularity * 0.3);
    // Chỉ loại hẳn khi không dính query chút nào và không phải Spotify
    if (
      !phrase &&
      inFull.length === 0 &&
      !(track.spotify_url || track.source === "spotify-search")
    ) {
      s = 0;
    }
    return { track, s };
  });

  const kept = scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.track);

  // Nếu soft-filter rỗng → trả nguyên list server (full Spotify)
  if (!kept.length) return tracks.slice(0, limit);
  return kept.slice(0, limit);
}

/** Tìm nhạc theo tên — full Spotify catalog qua API server */
export const searchMusicByQuery = async (query, limit = 30) => {
  const q = String(query || "").trim();
  if (!q) return [];
  try {
    // Lấy full Spotify (server max 50)
    const fetchLimit = Math.min(50, Math.max(Number(limit) || 30, 25));
    const res = await api.post(
      "/api/searchMusic",
      { query: q, limit: fetchLimit },
      { timeout: 20000 },
    );
    if (res?.data?.status === "success" && Array.isArray(res.data.data)) {
      // Server đã Spotify-first rank — chỉ soft-rank client, không cắt quá gắt
      const list = res.data.data;
      const ranked = rankTracksByQuery(q, list, fetchLimit);
      const out = ranked.length ? ranked : list;
      // Ưu tiên bài có spotify_url lên đầu
      out.sort((a, b) => {
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
