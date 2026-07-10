/**
 * Spotify Web API (user token) — search / now playing / recently played.
 */
import {
  getSpotifyAccessToken,
  isSpotifyUserLinked,
} from "@/utils/spotifyUserAuth";

async function spotifyFetch(localId, path, opts = {}) {
  const token = await getSpotifyAccessToken(localId);
  if (!token) {
    const err = new Error("SPOTIFY_NOT_LINKED");
    err.code = "SPOTIFY_NOT_LINKED";
    throw err;
  }

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(opts.headers || {}),
    },
  });

  if (res.status === 204) return null;
  if (res.status === 401) {
    const err = new Error("SPOTIFY_UNAUTHORIZED");
    err.code = "SPOTIFY_UNAUTHORIZED";
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      data?.error?.message || `Spotify API ${res.status}`,
    );
    err.code = "SPOTIFY_API";
    err.status = res.status;
    throw err;
  }
  return data;
}

function mapTrack(t) {
  if (!t?.id) return null;
  const artists = (t.artists || []).map((a) => a.name).filter(Boolean);
  return {
    id: t.id,
    song_name: t.name || "",
    song_title: t.name || "",
    name: t.name || "",
    artist: artists.join(", "),
    album: t.album?.name || "",
    image_url:
      t.album?.images?.[0]?.url ||
      t.album?.images?.[1]?.url ||
      t.album?.images?.[2]?.url ||
      "",
    preview_url: t.preview_url || null,
    isrc: t.external_ids?.isrc || null,
    spotify_url:
      t.external_urls?.spotify ||
      `https://open.spotify.com/track/${t.id}`,
    duration_ms: t.duration_ms || 0,
    platform: "spotify",
    title: [t.name, artists.join(", ")].filter(Boolean).join(" - "),
  };
}

export async function searchSpotifyTracks(localId, query, limit = 15) {
  const q = String(query || "").trim();
  if (!q) return [];
  const data = await spotifyFetch(
    localId,
    `/search?${new URLSearchParams({
      q,
      type: "track",
      limit: String(limit),
      market: "from_token",
    })}`,
  );
  return (data?.tracks?.items || []).map(mapTrack).filter(Boolean);
}

export async function getSpotifyCurrentlyPlaying(localId) {
  try {
    const data = await spotifyFetch(
      localId,
      "/me/player/currently-playing?additional_types=track",
    );
    if (!data?.item) return null;
    const track = mapTrack(data.item);
    if (!track) return null;
    return {
      ...track,
      is_playing: Boolean(data.is_playing),
      progress_ms: data.progress_ms || 0,
    };
  } catch (e) {
    if (e?.status === 204) return null;
    throw e;
  }
}

export async function getSpotifyRecentlyPlayed(localId, limit = 20) {
  const data = await spotifyFetch(
    localId,
    `/me/player/recently-played?limit=${limit}`,
  );
  const items = data?.items || [];
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const t = mapTrack(it.track);
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

export async function getSpotifyTopTracks(localId, limit = 15) {
  try {
    const data = await spotifyFetch(
      localId,
      `/me/top/tracks?limit=${limit}&time_range=short_term`,
    );
    return (data?.items || []).map(mapTrack).filter(Boolean);
  } catch {
    return [];
  }
}

export { isSpotifyUserLinked };
