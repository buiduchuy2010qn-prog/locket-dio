/**
 * Music library API client — real backend (/api/music/*).
 */
import api from "@/libs/axios";

export async function listMusicTracks() {
  const res = await api.get("/api/music/tracks", { timeout: 15000 });
  if (res?.data?.status === "success") return res.data.data || [];
  return [];
}

export async function searchMusicLibrary(query, limit = 40) {
  const q = String(query || "").trim();
  const res = await api.get("/api/music/search", {
    params: { q, limit },
    timeout: 20000,
  });
  if (res?.data?.status === "success") return res.data.data || [];
  return [];
}

/**
 * Upload audio file from device.
 * @param {File|Blob} file
 * @param {{ title?: string, artist?: string, duration?: number }} meta
 */
export async function uploadMusicTrack(file, meta = {}) {
  if (!file) throw new Error("Thiếu file nhạc");
  const fd = new FormData();
  fd.append("file", file, file.name || "audio.mp3");
  if (meta.title) fd.append("title", meta.title);
  if (meta.artist) fd.append("artist", meta.artist);
  if (meta.duration != null) fd.append("duration", String(meta.duration));
  if (meta.coverUrl) fd.append("coverUrl", meta.coverUrl);

  const res = await api.post("/api/music/upload", fd, {
    timeout: 60000,
    headers: { "Content-Type": "multipart/form-data" },
  });
  if (res?.data?.status === "success") return res.data.data;
  throw new Error(res?.data?.message || "Upload nhạc thất bại");
}

export async function attachMomentMusic(momentId, payload) {
  const res = await api.post(`/api/moments/${momentId}/music`, payload, {
    timeout: 15000,
  });
  if (res?.data?.status === "success") return res.data.data;
  throw new Error(res?.data?.message || "Gắn nhạc thất bại");
}

export async function getMomentMusic(momentId) {
  try {
    const res = await api.get(`/api/moments/${momentId}/music`, {
      timeout: 10000,
    });
    if (res?.data?.status === "success") return res.data.data;
  } catch {
    return null;
  }
  return null;
}

export async function deleteMomentMusic(momentId) {
  const res = await api.delete(`/api/moments/${momentId}/music`, {
    timeout: 10000,
  });
  return res?.data;
}

/**
 * Build Locket optionsData music payload from library track + trim settings.
 */
export function toLocketMusicOptions(track, opts = {}) {
  const start = Number(opts.startTime) || 0;
  const end = Number(opts.endTime) || Number(track.duration) || 30;
  const volume = Number(opts.volume ?? 1);
  const originalVideoVolume = Number(opts.originalVideoVolume ?? 1);

  const song_title = track.title || track.song_title || track.song_name || "";
  const artist = track.artist || "";
  const preview =
    track.preview_url ||
    track.audioUrl ||
    track.audio_url ||
    "";

  return {
    type: "music",
    caption: opts.caption || [song_title, artist].filter(Boolean).join(" - "),
    payload: {
      song_title,
      song_name: song_title,
      name: song_title,
      artist,
      preview_url: preview,
      audio: preview,
      image: track.coverUrl || track.image_url || "",
      image_url: track.coverUrl || track.image_url || "",
      isrc: track.isrc || null,
      spotify_url: track.spotify_url || null,
      apple_music_url: track.apple_music_url || null,
      platform: track.platform || track.source || "upload",
      // local library fields for playback
      musicTrackId: track.id || null,
      startTime: start,
      endTime: end,
      volume,
      originalVideoVolume,
      duration: track.duration || end,
    },
  };
}
