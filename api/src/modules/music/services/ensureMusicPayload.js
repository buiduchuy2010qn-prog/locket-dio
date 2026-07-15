/**
 * Đảm bảo payload music đủ isrc + preview + platform URL trước khi gửi Locket.
 * App Locket cần: isrc + song_title + artist + (spotify_url | apple_music_url) + icon.
 * Web merge local vẫn hiện nếu chỉ có isrc — nhưng app thật thì không.
 *
 * iOS playback: giữ apple_music_url (MusicKit) ngay cả khi đã có spotify_url.
 * Android playback: giữ spotify_url như cũ — không drop / không đổi thứ tự ưu tiên badge.
 *
 * Lưu ý (Buông·Hngle fail case):
 * - URL Apple phải sạch (không uo=/tracking)
 * - Ưu tiên cover/preview iTunes (mzstatic) thay Deezer signed
 * - Spotify + Apple clean cùng lúc khi resolve được (dual, không XOR)
 */
const {
  fetchMusicApi,
  searchMusicByQuery,
  resolveIsrcAggressive,
  normalizeIsrc,
  normalizeAppleMusicUrl,
  isPlayableAppleMusicUrl,
  isStablePreviewUrl,
  isStableCoverUrl,
  enrichFromItunes,
  fetchSongLink,
  searchSpotifyByIsrc,
  enrichTrackPlatforms,
} = require("./fetchMusicApi");

function isSignedEphemeralPreview(url = "") {
  return !isStablePreviewUrl(url);
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

function cleanSpotifyUrl(url = "") {
  const s = String(url || "").trim();
  if (!s) return null;
  const m = s.match(
    /(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?track\/|spotify:track:)([a-zA-Z0-9]{10,})/i,
  );
  if (m) return `https://open.spotify.com/track/${m[1]}`;
  return s.split("?")[0] || s;
}

/** Chấm điểm URL Apple — slug thật > `/_/` ; có ?i= ; /vn/ khi ISRC VN */
function scoreAppleUrl(url = "", isrc = "") {
  const s = String(url || "");
  if (!s) return -1;
  let score = 0;
  if (/[?&]i=\d+/.test(s) || /\?i=\d+/.test(s)) score += 50;
  if (/\/album\/_\//i.test(s)) score -= 40; // slug rỗng từ song.link
  else if (/\/album\/[^/?]+\/\d+/i.test(s)) score += 30;
  if (/^VNA/i.test(String(isrc || "")) && /music\.apple\.com\/vn\//i.test(s)) {
    score += 20;
  }
  if (/uo=|at=|ct=|itscg=/i.test(s)) score -= 5;
  return score;
}

function pickBetterAppleUrl(current, candidate, isrc = "") {
  const a = normalizeAppleMusicUrl(current || "") || null;
  const b = normalizeAppleMusicUrl(candidate || "") || null;
  if (!a) return b;
  if (!b) return a;
  return scoreAppleUrl(b, isrc) > scoreAppleUrl(a, isrc) ? b : a;
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
  let spotify_url = cleanSpotifyUrl(payload.spotify_url || "");
  let apple_music_url = normalizeAppleMusicUrl(
    payload.apple_music_url || payload.appleMusicUrl || "",
  );

  const needIsrc = !isrc;
  const needStablePreview = !preview || isSignedEphemeralPreview(preview);
  const needStableCover = !image_url || !isStableCoverUrl(image_url);
  // QUAN TRỌNG: app Locket không hiện nhạc nếu thiếu cả 2 link platform
  const needPlatformUrl = !spotify_url && !apple_music_url;

  if (needIsrc || needStablePreview || needPlatformUrl || needStableCover) {
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
          if (fresh.image_url && (needStableCover || !image_url)) {
            image_url = fresh.image_url;
          }
          spotify_url =
            spotify_url || cleanSpotifyUrl(fresh.spotify_url || "") || null;
          apple_music_url = pickBetterAppleUrl(
            apple_music_url,
            fresh.apple_music_url,
            isrc,
          );
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
          if (hit.image_url && (needStableCover || !image_url)) {
            image_url = hit.image_url;
          }
          spotify_url =
            spotify_url || cleanSpotifyUrl(hit.spotify_url || "") || null;
          apple_music_url = pickBetterAppleUrl(
            apple_music_url,
            hit.apple_music_url,
            isrc,
          );
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

  // Apple URL sạch + cover/preview iTunes (VN → US) — case Buông apple-only
  if (
    song_title &&
    (!spotify_url ||
      !apple_music_url ||
      scoreAppleUrl(apple_music_url, isrc) < 40 ||
      !isStableCoverUrl(image_url) ||
      !isStablePreviewUrl(preview || ""))
  ) {
    try {
      const it = await enrichFromItunes(song_title, artist);
      if (it) {
        apple_music_url = pickBetterAppleUrl(
          apple_music_url,
          it.apple_music_url,
          isrc,
        );
        if (it.preview_url && (!preview || isSignedEphemeralPreview(preview))) {
          preview = it.preview_url;
        }
        if (it.image_url && (!image_url || !isStableCoverUrl(image_url))) {
          image_url = it.image_url;
        }
        isrc = isrc || normalizeIsrc(it.isrc);
      }
    } catch (e) {
      console.warn("[ensureMusicOptionsData] iTunes enrich:", e.message);
    }
  }

  // song.link / seed multi-source cross-map (Apple ↔ Spotify ↔ Deezer)
  // Android cần spotify_url; iOS cần Apple ?i=
  const songLinkSeeds = [
    spotify_url,
    apple_music_url,
    payload.deezer_url,
    payload.deezerId
      ? `https://www.deezer.com/track/${payload.deezerId}`
      : null,
  ].filter(Boolean);
  for (const seed of songLinkSeeds) {
    if (spotify_url && isPlayableAppleMusicUrl(apple_music_url)) break;
    try {
      const sl = await fetchSongLink(seed);
      if (!sl) continue;
      if (!spotify_url && sl.spotify_url) {
        spotify_url = cleanSpotifyUrl(sl.spotify_url);
        console.log(
          `[ensureMusicOptionsData] song.link → Spotify for "${song_title}"`,
        );
      }
      if (sl.apple_music_url) {
        apple_music_url = pickBetterAppleUrl(
          apple_music_url,
          sl.apple_music_url,
          isrc,
        );
      }
      if (sl.image_url && (!image_url || !isStableCoverUrl(image_url))) {
        image_url = sl.image_url;
      }
    } catch (e) {
      console.warn("[ensureMusicOptionsData] song.link:", e.message);
    }
  }

  // Spotify by ISRC + full enrich (Android playback)
  if (!spotify_url && isrc) {
    try {
      const sp = await searchSpotifyByIsrc(isrc);
      if (sp?.spotify_url) {
        spotify_url = cleanSpotifyUrl(sp.spotify_url);
        console.log(
          `[ensureMusicOptionsData] Spotify ISRC → ${spotify_url} for "${song_title}"`,
        );
      }
    } catch (e) {
      console.warn("[ensureMusicOptionsData] searchSpotifyByIsrc:", e.message);
    }
  }
  if (!spotify_url || !isPlayableAppleMusicUrl(apple_music_url)) {
    try {
      const enriched = await enrichTrackPlatforms(
        {
          song_title,
          artist,
          isrc,
          spotify_url,
          apple_music_url,
          preview_url: preview,
          image_url,
          deezer_url: payload.deezer_url,
          deezerId: payload.deezerId || payload.deezer_id,
        },
        { full: true },
      );
      if (enriched) {
        spotify_url =
          spotify_url || cleanSpotifyUrl(enriched.spotify_url || "") || null;
        apple_music_url = pickBetterAppleUrl(
          apple_music_url,
          enriched.apple_music_url,
          isrc,
        );
        if (
          enriched.preview_url &&
          (!preview || isSignedEphemeralPreview(preview))
        ) {
          preview = enriched.preview_url;
        }
        if (enriched.image_url && (!image_url || !isStableCoverUrl(image_url))) {
          image_url = enriched.image_url;
        }
        isrc = isrc || normalizeIsrc(enriched.isrc);
      }
    } catch (e) {
      console.warn("[ensureMusicOptionsData] enrichTrackPlatforms:", e.message);
    }
  }

  // Final normalize
  spotify_url = cleanSpotifyUrl(spotify_url || "") || null;
  apple_music_url = normalizeAppleMusicUrl(apple_music_url || "") || null;

  // ISRC Việt → ép country /vn/ nếu đang /us/ cùng track id
  if (
    apple_music_url &&
    /^VNA/i.test(String(isrc || "")) &&
    /music\.apple\.com\/us\//i.test(apple_music_url)
  ) {
    apple_music_url = apple_music_url.replace(
      /music\.apple\.com\/us\//i,
      "music.apple.com/vn/",
    );
  }

  // Last resort for iOS: iTunes by title if Apple still not playable (?i= missing)
  if (!isPlayableAppleMusicUrl(apple_music_url) && song_title) {
    try {
      const it = await enrichFromItunes(song_title, artist);
      if (it?.apple_music_url && isPlayableAppleMusicUrl(it.apple_music_url)) {
        apple_music_url = normalizeAppleMusicUrl(it.apple_music_url);
        isrc = isrc || normalizeIsrc(it.isrc);
        if (it.preview_url && (!preview || isSignedEphemeralPreview(preview))) {
          preview = it.preview_url;
        }
        if (it.image_url && (!image_url || !isStableCoverUrl(image_url))) {
          image_url = it.image_url;
        }
        console.log(
          `[ensureMusicOptionsData] iTunes forced Apple for iOS "${song_title}" → ${apple_music_url}`,
        );
      }
    } catch (e) {
      console.warn("[ensureMusicOptionsData] final iTunes:", e.message);
    }
  }

  // Reject unusable Apple URLs (no track id) — iOS would stay silent
  if (apple_music_url && !isPlayableAppleMusicUrl(apple_music_url)) {
    console.warn(
      `[ensureMusicOptionsData] drop non-playable Apple URL: ${apple_music_url}`,
    );
    apple_music_url = null;
  }

  // iOS MusicKit: BẮT BUỘC apple_music_url playable (?i=). Thiếu = có tên nhưng im trên iPhone.
  if (!isPlayableAppleMusicUrl(apple_music_url)) {
    const err = new Error(
      "Thiếu link Apple Music hợp lệ (cần ?i=trackId) — iPhone sẽ không phát nhạc. Chọn bài khác hoặc dán link Apple Music.",
    );
    err.status = 400;
    throw err;
  }
  if (!spotify_url) {
    console.warn(
      `[ensureMusicOptionsData] no Spotify URL — Android may be silent: "${song_title}"`,
    );
  }

  // Bỏ preview hết hạn / signed — có thể làm app Locket bỏ overlay
  // iOS phát qua MusicKit (apple_music_url), không cần preview_url
  if (preview && isSignedEphemeralPreview(preview)) {
    console.warn(
      `[ensureMusicOptionsData] drop ephemeral preview for "${song_title}"`,
    );
    preview = null;
  }
  // Không gửi preview lên Locket — tránh iOS/Android reject overlay
  preview = null;

  // Platform badge: ưu tiên Spotify (Android ổn); Apple vẫn giữ song song cho iOS
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
    image_url: image_url || null,
    platform: platformOut,
  };
  // Dual platform — order: Apple first for iOS resolvers that scan fields early
  // - apple_music_url → iOS MusicKit (REQUIRED)
  // - spotify_url → Android Spotify
  if (apple_music_url) nextPayload.apple_music_url = apple_music_url;
  if (spotify_url) nextPayload.spotify_url = spotify_url;

  const nextIcon =
    image_url
      ? { type: "image", data: image_url, source: "url" }
      : optionsData.icon?.data
        ? {
            type: optionsData.icon.type || "image",
            data: optionsData.icon.data,
            source: optionsData.icon.source || "url",
          }
        : null;

  const caption =
    (optionsData.caption || optionsData.text || "").trim() ||
    [song_title, artist].filter(Boolean).join(" · ");

  console.log(
    `[ensureMusicOptionsData] ready isrc=${isrc || "none"} platform=${platformOut} title="${song_title}" apple=${apple_music_url ? "yes" : "no"} spotify=${spotify_url ? "yes" : "no"} cover=${image_url ? (isStableCoverUrl(image_url) ? "stable" : "weak") : "none"} preview=${preview ? "yes" : "no"}`,
  );

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
