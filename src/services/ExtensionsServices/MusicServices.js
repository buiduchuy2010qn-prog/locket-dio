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

/** Xếp lại client: đúng tựa / gần tựa lên đầu, lọc nhiễu */
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

      let s = 0;
      if (title === q) s += 2000;
      else if (title.startsWith(q)) s += 900;
      if (title.includes(q)) s += 500;
      if (full.includes(q)) s += 100;

      const inTitle = tokens.filter((t) => title.includes(t));
      const inFull = tokens.filter((t) => full.includes(t));
      if (tokens.length) {
        s += (inTitle.length / tokens.length) * 400;
        s += (inFull.length / tokens.length) * 60;
      }
      if (tokens.length > 1 && title.includes(tokens.join(" "))) s += 600;

      // "không buông" vs "không muốn…" — chỉ 1 token → hạ mạnh
      if (tokens.length >= 2 && inTitle.length === 1) s *= 0.08;
      else if (tokens.length >= 2 && inTitle.length < tokens.length) s *= 0.4;

      if (inFull.length === 0) s = 0;
      return { track, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  if (!scored.length) return tracks.slice(0, limit);

  const top = scored[0].s;
  const minKeep = top >= 400 ? Math.max(40, top * 0.12) : 8;
  const kept = scored.filter((x) => x.s >= minKeep).map((x) => x.track);
  return (kept.length ? kept : scored.map((x) => x.track)).slice(0, limit);
}

/** Tìm nhạc theo tên — không cần liên kết Spotify */
export const searchMusicByQuery = async (query, limit = 15) => {
  const q = String(query || "").trim();
  if (!q) return [];
  try {
    // Xin nhiều hơn → rank client lọc bài sát tựa
    const fetchLimit = Math.min(40, Math.max(Number(limit) || 15, 18));
    const res = await api.post("/api/searchMusic", {
      query: q,
      limit: fetchLimit,
    });
    if (res?.data?.status === "success" && Array.isArray(res.data.data)) {
      return rankTracksByQuery(q, res.data.data, limit);
    }
    return [];
  } catch (error) {
    console.error("🚨 searchMusicByQuery:", error.message);
    return [];
  }
};
