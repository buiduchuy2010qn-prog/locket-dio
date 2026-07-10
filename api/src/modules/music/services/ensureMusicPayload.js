/**
 * Đảm bảo payload music đủ isrc + preview ổn định trước khi gửi Locket.
 * Gọi lúc POST moment (server-side) để bù client thiếu/cold-start.
 */
const { fetchMusicApi } = require("./fetchMusicApi");

function isSignedEphemeralPreview(url = "") {
  const u = String(url || "");
  if (!u) return true;
  // Deezer signed CDN — hết hạn theo hdnea=exp=
  if (/dzcdn\.net|deezer\.com.*hdnea=/i.test(u)) return true;
  // Spotify preview đôi khi 403 / mất
  if (/p\.scdn\.co/i.test(u)) return true;
  return false;
}

function pickSongTitle(p = {}) {
  return (
    p.song_title ||
    p.song_name ||
    p.name ||
    (typeof p.title === "string" && !p.title.includes(" - ")
      ? p.title
      : "") ||
    ""
  );
}

/**
 * @param {object} optionsData - optionsData từ client (type music)
 * @returns {Promise<object>} optionsData đã enrich payload
 */
async function ensureMusicOptionsData(optionsData = {}) {
  if (!optionsData || optionsData.type !== "music") return optionsData;

  const payload = { ...(optionsData.payload || {}) };
  let isrc = payload.isrc ? String(payload.isrc).trim() : "";
  let preview =
    payload.preview_url || payload.previewUrl || payload.audio || null;
  let song_title = pickSongTitle(payload);
  let artist = payload.artist || "";
  let image_url = payload.image_url || payload.image || optionsData.icon?.data || "";
  let spotify_url = payload.spotify_url || null;
  let apple_music_url =
    payload.apple_music_url || payload.appleMusicUrl || null;

  const needIsrc = !isrc;
  const needStablePreview = !preview || isSignedEphemeralPreview(preview);

  if (needIsrc || needStablePreview) {
    const link =
      spotify_url ||
      apple_music_url ||
      payload.url ||
      payload.spotifyUrl ||
      null;
    const platform =
      payload.platform ||
      optionsData.platform ||
      (apple_music_url && !spotify_url ? "apple" : "spotify");

    if (link) {
      try {
        const fresh = await fetchMusicApi(link, platform);
        if (fresh) {
          isrc = isrc || (fresh.isrc ? String(fresh.isrc).trim() : "");
          if (needStablePreview && fresh.preview_url) {
            preview = fresh.preview_url;
          } else if (!preview && fresh.preview_url) {
            preview = fresh.preview_url;
          }
          song_title =
            song_title ||
            fresh.song_title ||
            fresh.song_name ||
            fresh.name ||
            "";
          artist = artist || fresh.artist || "";
          image_url = image_url || fresh.image_url || "";
          spotify_url = spotify_url || fresh.spotify_url || null;
          apple_music_url =
            apple_music_url || fresh.apple_music_url || null;
        }
      } catch (e) {
        console.warn("[ensureMusicOptionsData] re-fetch failed:", e.message);
      }
    }
  }

  const nextPayload = {
    ...payload,
    song_title: song_title || payload.song_title || "",
    song_name: song_title || payload.song_name || "",
    name: song_title || payload.name || "",
    artist,
    isrc: isrc || null,
    preview_url: preview || null,
    image_url: image_url || null,
    platform: payload.platform || optionsData.platform || "spotify",
  };
  if (spotify_url) nextPayload.spotify_url = spotify_url;
  if (apple_music_url) nextPayload.apple_music_url = apple_music_url;

  const nextIcon =
    optionsData.icon?.data
      ? optionsData.icon
      : image_url
        ? { type: "image", data: image_url, source: "url" }
        : optionsData.icon;

  const caption =
    (optionsData.caption || optionsData.text || "").trim() ||
    [song_title, artist].filter(Boolean).join(" - ");

  return {
    ...optionsData,
    caption,
    text: optionsData.text || caption,
    payload: nextPayload,
    icon: nextIcon,
    platform: nextPayload.platform,
  };
}

module.exports = {
  ensureMusicOptionsData,
  isSignedEphemeralPreview,
};
