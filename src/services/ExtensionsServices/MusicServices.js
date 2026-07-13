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

/** Xếp lại client: đúng tựa / gần tựa; lọc false-positive substring */
function rankTracksByQuery(query, tracks, limit = 15) {
  const q = normalizeSearchText(query);
  if (!q || !Array.isArray(tracks) || !tracks.length) return tracks || [];

  const tokens = q.split(" ").filter(Boolean);

  const scored = tracks
    .map((track) => {
      const title = normalizeSearchText(
        track.song_title || track.song_name || track.name || "",
      );
      const artist = normalizeSearchText(track.artist || "");
      const full = `${title} ${artist}`;
      if (!title) return { track, s: 0 };

      const inTitle = tokens.filter((t) => tokenAsWord(t, title));
      const inFull = tokens.filter((t) => tokenAsWord(t, full));
      const phrase = title.includes(q) || title === q;

      if (tokens.length >= 2) {
        if (!phrase && inTitle.length < tokens.length && inFull.length < tokens.length) {
          return { track, s: 0 };
        }
      } else if (!tokenAsWord(tokens[0], full) && !phrase) {
        return { track, s: 0 };
      }

      let s = 0;
      if (title === q) s += 5000;
      else if (title.startsWith(q)) s += 2500;
      if (phrase) s += 1500;
      if (tokens.length > 1 && title.includes(tokens.join(" "))) s += 1200;
      s += (inTitle.length / tokens.length) * 800;
      if (tokens.length >= 2 && inTitle.length === 1) s *= 0.05;
      if (s < 200 && !phrase) s = 0;
      return { track, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (!scored.length) return [];

  const top = scored[0].s;
  const minKeep =
    top >= 1500 ? Math.max(400, top * 0.2) : top >= 500 ? 200 : top * 0.85;
  const kept = scored.filter((x) => x.s >= minKeep).map((x) => x.track);
  return (kept.length ? kept : scored.slice(0, 3).map((x) => x.track)).slice(
    0,
    limit,
  );
}

/** Tìm nhạc theo tên — không cần liên kết Spotify */
export const searchMusicByQuery = async (query, limit = 15) => {
  const q = String(query || "").trim();
  if (!q) return [];
  try {
    const fetchLimit = Math.min(20, Math.max(Number(limit) || 12, 12));
    const res = await api.post(
      "/api/searchMusic",
      { query: q, limit: fetchLimit },
      { timeout: 15000 },
    );
    if (res?.data?.status === "success" && Array.isArray(res.data.data)) {
      const ranked = rankTracksByQuery(q, res.data.data, limit);
      // Server đã rank; client rank rỗng thì vẫn hiện list server
      return ranked.length ? ranked : res.data.data.slice(0, limit);
    }
    return [];
  } catch (error) {
    console.error("🚨 searchMusicByQuery:", error.message);
    throw error;
  }
};
