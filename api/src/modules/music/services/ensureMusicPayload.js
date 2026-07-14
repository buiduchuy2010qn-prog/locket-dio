/**
 * Đảm bảo payload music đủ isrc + preview + platform URL trước khi gửi Locket.
 * App Locket cần: isrc + song_title + artist + (spotify_url | apple_music_url) + icon.
 * Web merge local vẫn hiện nếu chỉ có isrc — nhưng app thật thì không.
 */
const {
  fetchMusicApi,
  searchMusicByQuery,
  resolveIsrcAggressive,
  normalizeIsrc,
} = require("./fetchMusicApi");

function isSignedEphemeralPreview(url = "") {
  const u = String(url || "");
  if (!u) return true;
  if (/dzcdn\.net|deezer\.com.*hdnea=/i.test(u)) return true;
  if (/p\.scdn\.co/i.test(u)) return true;
  return false;
}

function pickSongTitle(p = {}) {
  return (
    p.song_title ||
    p.song_name ||
    p.name ||
    (typeof p.title === "string" &&
    !p.title.includes(" - ") &&
    !p.title.includes(" · ")
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

  const payload = {
    ...(optionsData.payload || {}),
    ...(optionsData.music || {}),
  };
  let isrc = normalizeIsrc(payload.isrc);
  let preview =
    payload.preview_url || payload.previewUrl || payload.audio || null;
  let song_title = pickSongTitle(payload);
  let artist = payload.artist || "";
  let image_url =
    payload.image_url || payload.image || optionsData.icon?.data || "";
  let spotify_url = payload.spotify_url || null;
  let apple_music_url =
    payload.apple_music_url || payload.appleMusicUrl || null;

  const needIsrc = !isrc;
  const needStablePreview = !preview || isSignedEphemeralPreview(preview);
  // QUAN TRỌNG: app Locket không hiện nhạc nếu thiếu cả 2 link platform
  const needPlatformUrl = !spotify_url && !apple_music_url;

  if (needIsrc || needStablePreview || needPlatformUrl) {
    let link =
      spotify_url ||
      apple_music_url ||
      payload.url ||
      payload.spotifyUrl ||
      null;
    const platform =
      payload.platform ||
      optionsData.platform ||
      (apple_music_url && !spotify_url ? "apple" : "spotify");

    if (
      !link &&
      payload.id &&
      typeof payload.id === "string" &&
      /^[a-zA-Z0-9]{10,22}$/.test(payload.id) &&
      !String(payload.source || "").includes("deezer") &&
      !String(payload.source || "").includes("itunes")
    ) {
      link = `https://open.spotify.com/track/${payload.id}`;
      spotify_url = link;
    }

    if (link) {
      try {
        const fresh = await fetchMusicApi(
          link,
          /music\.apple|itunes\.apple/i.test(link) ? "apple" : platform,
        );
        if (fresh) {
          isrc = isrc || normalizeIsrc(fresh.isrc);
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

    // Search theo tên: lấy ISRC + apple_music_url (iTunes/Deezer)
    if ((!isrc || needPlatformUrl) && song_title) {
      try {
        const hits = await searchMusicByQuery(
          [song_title, artist].filter(Boolean).join(" "),
          12,
        );
        const hit =
          (hits || []).find(
            (h) => h.isrc && (h.apple_music_url || h.spotify_url),
          ) ||
          (hits || []).find((h) => normalizeIsrc(h.isrc)) ||
          (hits || []).find((h) => h.apple_music_url) ||
          (hits || [])[0] ||
          null;
        if (hit) {
          isrc = isrc || normalizeIsrc(hit.isrc);
          if (!preview && hit.preview_url) preview = hit.preview_url;
          song_title =
            song_title ||
            hit.song_title ||
            hit.song_name ||
            hit.name ||
            "";
          artist = artist || hit.artist || "";
          image_url = image_url || hit.image_url || "";
          spotify_url = spotify_url || hit.spotify_url || null;
          apple_music_url =
            apple_music_url || hit.apple_music_url || null;
        }
      } catch (e) {
        console.warn(
          "[ensureMusicOptionsData] search fallback failed:",
          e.message,
        );
      }
    }
  }

  // ISRC aggressive: Deezer → iTunes → MusicBrainz (bắt buộc cho app Locket)
  if (!isrc && song_title) {
    try {
      const forced = await resolveIsrcAggressive({
        songName: song_title,
        artist,
        deezerId: payload.deezerId || payload.deezer_id || null,
        existingIsrc: payload.isrc,
      });
      if (forced) {
        isrc = forced;
        console.log(
          `[ensureMusicOptionsData] ISRC resolved: ${isrc} for "${song_title}"`,
        );
      }
    } catch (e) {
      console.warn("[ensureMusicOptionsData] resolveIsrcAggressive:", e.message);
    }
  } else {
    isrc = normalizeIsrc(isrc);
  }

  // Platform: ưu tiên link có sẵn; Apple OK khi không có Spotify
  let platformOut = "spotify";
  if (spotify_url) platformOut = "spotify";
  else if (apple_music_url) platformOut = "apple";
  else if (payload.platform === "apple" || optionsData.platform === "apple") {
    platformOut = "apple";
  }

  const nextPayload = {
    song_title: song_title || payload.song_title || "",
    song_name: song_title || payload.song_name || "",
    name: song_title || payload.name || "",
    artist,
    isrc: isrc || null,
    preview_url: preview || null,
    image_url: image_url || null,
    platform: platformOut,
  };
  // XOR — chỉ 1 platform URL cho Locket
  if (spotify_url) nextPayload.spotify_url = spotify_url;
  else if (apple_music_url) nextPayload.apple_music_url = apple_music_url;

  const nextIcon =
    optionsData.icon?.data
      ? {
          type: optionsData.icon.type || "image",
          data: optionsData.icon.data,
          source: optionsData.icon.source || "url",
        }
      : image_url
        ? { type: "image", data: image_url, source: "url" }
        : null;

  const caption =
    (optionsData.caption || optionsData.text || "").trim() ||
    [song_title, artist].filter(Boolean).join(" · ");

  return {
    ...optionsData,
    caption,
    text: caption,
    payload: nextPayload,
    // Legacy alias — một số path đọc music.*
    music: {
      ...(optionsData.music || {}),
      ...nextPayload,
      image: image_url || null,
    },
    icon: nextIcon,
    platform: platformOut,
  };
}

module.exports = {
  ensureMusicOptionsData,
  isSignedEphemeralPreview,
};
