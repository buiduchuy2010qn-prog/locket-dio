/**
 * Resolve preview audio for web MusicPlayer.
 * Ưu tiên iTunes (ổn định); Deezer signed hay hết hạn giữa chừng.
 */

const cache = new Map();

export function isEphemeralPreviewUrl(url = "") {
  return /dzcdn\.net|hdnea=|cdnt-preview|p\.scdn\.co/i.test(String(url || ""));
}

export function isStablePreviewUrl(url = "") {
  const u = String(url || "");
  if (!u) return false;
  if (isEphemeralPreviewUrl(u)) return false;
  return /audio-ssl\.itunes\.apple\.com|mzstatic\.com/i.test(u) || /\.m4a(\?|$)/i.test(u);
}

/**
 * Lấy preview_url iTunes theo tên bài + ca sĩ (CORS mở).
 * @returns {Promise<{preview_url:string, image_url?:string, apple_music_url?:string}|null>}
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
      url.searchParams.set("limit", "8");
      url.searchParams.set("country", country);
      const res = await fetch(url.toString());
      if (!res.ok) continue;
      const data = await res.json();
      const rows = data?.results || [];
      const titleL = title.toLowerCase();
      const artistL = String(artist || "").toLowerCase();
      const best =
        rows.find(
          (r) =>
            String(r.trackName || "")
              .toLowerCase()
              .includes(titleL.slice(0, 12)) &&
            (!artistL ||
              String(r.artistName || "")
                .toLowerCase()
                .includes(artistL.slice(0, 8))),
        ) ||
        rows.find((r) => r.previewUrl) ||
        null;
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
          image_url: (best.artworkUrl100 || "").replace("100x100", "600x600") || "",
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
 * @param {object} payload music payload from overlay
 * @returns {Promise<string|null>} playable preview URL
 */
export async function resolvePlayablePreview(payload = {}) {
  const current =
    payload.preview_url ||
    payload.previewUrl ||
    payload.audio ||
    payload.preview ||
    null;
  if (current && isStablePreviewUrl(current)) return current;
  if (current && !isEphemeralPreviewUrl(current)) return current;

  const song =
    payload.song_title || payload.song_name || payload.name || payload.title || "";
  const artist = payload.artist || "";
  const hit = await fetchItunesPreview(song, artist);
  return hit?.preview_url || current || null;
}
