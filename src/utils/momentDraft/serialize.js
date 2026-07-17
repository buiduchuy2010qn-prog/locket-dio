export const MAX_DRAFT_IMAGE_MB = 20;
export const MAX_DRAFT_VIDEO_MB = 90;

export function serializeMusicFromOverlay(payload = {}) {
  if (!payload || typeof payload !== "object") return null;
  return {
    song_title: payload.song_title || payload.song_name || payload.title || "",
    song_name: payload.song_name || payload.song_title || payload.title || "",
    artist: payload.artist || "",
    isrc: payload.isrc || "",
    spotify_url: payload.spotify_url || payload.spotifyUrl || "",
    apple_music_url: payload.apple_music_url || payload.appleMusicUrl || "",
    image_url: payload.image_url || payload.image || payload.cover || "",
    preview_url:
      payload.preview_url || payload.previewUrl || payload.audio || "",
    musicTrackId: payload.musicTrackId || null,
    startTime: payload.startTime ?? 0,
    endTime: payload.endTime ?? payload.duration ?? null,
    duration: payload.duration ?? null,
    volume: payload.volume ?? 1,
    platform: payload.platform || null,
  };
}

/**
 * Strip secrets / non-serializable fields before IndexedDB.
 */
export function sanitizeOverlayForDraft(overlayData = {}) {
  const o = { ...(overlayData || {}) };
  delete o.token;
  delete o.idToken;
  delete o.accessToken;
  delete o.firebaseToken;
  delete o.vi;
  delete o.vi_label;
  delete o.translation;
  delete o.viLabel;
  delete o.romaji;
  delete o.romaji_label;
  delete o._jp_preset;
  delete o.category;
  delete o.ja;
  if (o.type === "music" && o.payload) {
    o.payload = serializeMusicFromOverlay(o.payload) || {};
  }
  return o;
}
