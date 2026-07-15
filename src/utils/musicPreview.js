/**
 * Resolve preview audio ổn định (iTunes) cho web MusicPlayer.
 * Deezer signed / Spotify CDN hay hết hạn → luôn fallback iTunes.
 */

const cache = new Map();

export function isEphemeralPreviewUrl(url = "") {
  return /dzcdn\.net|hdnea=|cdnt-preview|p\.scdn\.co/i.test(String(url || ""));
}

export function isStablePreviewUrl(url = "") {
  const u = String(url || "");
  if (!u) return false;
  if (isEphemeralPreviewUrl(u)) return false;
  return (
    /audio-ssl\.itunes\.apple\.com|mzstatic\.com/i.test(u) ||
    /\.m4a(\?|$)/i.test(u) ||
    /\.mp3(\?|$)/i.test(u)
  );
}

/** Tách "Tên · Nghệ sĩ" / "Tên - Nghệ sĩ" từ caption */
export function parseSongCaption(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return { title: "", artist: "" };
  const parts = raw.split(/\s*[·|–—-]\s+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { title: parts[0], artist: parts.slice(1).join(" - ") };
  }
  return { title: raw, artist: "" };
}

/**
 * Lấy preview_url iTunes theo tên bài + ca sĩ (CORS mở, không cần API key).
 */
export async function fetchItunesPreview(songTitle, artist = "") {
  const title = String(songTitle || "").trim();
  if (!title) return null;

  const key = `${title}|${artist}`.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const term = [title, artist].filter(Boolean).join(" ");
  for (const country of ["vn", "us"]) {
    try {
      const url = new URL("https://itunes.apple.com/search");
      url.searchParams.set("term", term);
      url.searchParams.set("media", "music");
      url.searchParams.set("entity", "song");
      url.searchParams.set("limit", "12");
      url.searchParams.set("country", country);
      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();
      const rows = (data?.results || []).filter((r) => r.previewUrl);
      if (!rows.length) continue;

      const titleL = title.toLowerCase();
      const artistL = String(artist || "").toLowerCase();
      const titleSlice = titleL.slice(0, Math.min(16, titleL.length));

      const best =
        rows.find((r) => {
          const tn = String(r.trackName || "").toLowerCase();
          const an = String(r.artistName || "").toLowerCase();
          const titleOk = tn.includes(titleSlice) || titleL.includes(tn.slice(0, 12));
          const artistOk =
            !artistL ||
            an.includes(artistL.slice(0, 8)) ||
            artistL.includes(an.slice(0, 8));
          return titleOk && artistOk;
        }) ||
        rows.find((r) =>
          String(r.trackName || "")
            .toLowerCase()
            .includes(titleSlice),
        ) ||
        rows[0];

      if (best?.previewUrl) {
        let apple = best.trackViewUrl || null;
        try {
          if (apple) {
            const u = new URL(apple);
            const i = u.searchParams.get("i");
            apple = `https://music.apple.com${u.pathname}${i ? `?i=${i}` : ""}`;
          }
        } catch {
          /* keep */
        }
        const out = {
          preview_url: best.previewUrl,
          image_url:
            (best.artworkUrl100 || "").replace("100x100", "600x600") || "",
          apple_music_url: apple,
          song_title: best.trackName || title,
          artist: best.artistName || artist,
        };
        cache.set(key, out);
        return out;
      }
    } catch {
      /* try next country */
    }
  }
  cache.set(key, null);
  return null;
}

/**
 * @param {object} payload music payload / overlay
 * @returns {Promise<string|null>} playable preview URL
 */
export async function resolvePlayablePreview(payload = {}) {
  const p = payload || {};

  // 1) URL có sẵn ổn định
  const current =
    p.preview_url ||
    p.previewUrl ||
    p.audio ||
    p.preview ||
    p.audioUrl ||
    null;
  if (current && isStablePreviewUrl(current)) return current;
  if (current && !isEphemeralPreviewUrl(current) && /^https?:\/\//i.test(current)) {
    return current;
  }

  // 2) Tên bài từ payload hoặc caption text
  let song =
    p.song_title ||
    p.song_name ||
    p.name ||
    (typeof p.title === "string" && !/[·|]/.test(p.title) ? p.title : "") ||
    "";
  let artist = p.artist || "";

  if (!song && (p.text || p.caption)) {
    const parsed = parseSongCaption(p.text || p.caption);
    song = parsed.title;
    artist = artist || parsed.artist;
  }

  // Caption dạng "title · artist" trong title field
  if (!artist && song && /[·|]/.test(song)) {
    const parsed = parseSongCaption(song);
    song = parsed.title;
    artist = parsed.artist;
  }

  if (!song) return current || null;

  const hit = await fetchItunesPreview(song, artist);
  if (hit?.preview_url) return hit.preview_url;

  // Thử chỉ title (bỏ artist nếu match sai)
  if (artist) {
    const hit2 = await fetchItunesPreview(song, "");
    if (hit2?.preview_url) return hit2.preview_url;
  }

  // URL ephemeral còn dùng tạm nếu iTunes miss
  return current || null;
}
