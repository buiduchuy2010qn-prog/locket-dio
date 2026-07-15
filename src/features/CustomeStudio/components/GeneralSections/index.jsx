import React, { useEffect, useState, useMemo } from "react";
import { PiClockFill } from "react-icons/pi";
import { useApp } from "@/context/AppContext";
import { useBatteryStatus } from "@/utils";
import { getInfoMusicByUrl } from "@/services";
import {
  normalizeIsrc,
  resolveMusicForLocket,
  searchMusicByQuery,
  ensureIosAppleOnTrack,
  isPlayableAppleMusicUrl,
  lookupItunesForLocket,
} from "@/services/ExtensionsServices/MusicServices";
import {
  SonnerError,
  SonnerInfo,
  SonnerSuccess,
} from "@/components/uikit/SonnerToast";
import { useTranslation } from "react-i18next";
import FormMusicPoup from "@/features/FormMusicPoup";
import FormSpotifyPicker from "@/features/FormSpotifyPicker";
import FormReviewPoup from "@/features/FormReviewPoup";
import {
  useAuthStore,
  useOverlayEditorStore,
  useStreakStore,
  useUploadQueueStore,
} from "@/stores";
import IconRenderer from "@/components/Overlay/icons/IconRenderer";
import { getCaptionStyle } from "@/helpers/styleHelpers";
import {
  useCurrentWeatherV2,
  useCurrentLocation,
  useMediaPalette,
} from "../../hooks";
import LocationIcon from "@/assets/icons/LocationIcon";
import { Music2 } from "lucide-react";
import { getMomentsByUser } from "@/cache/momentDB";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";

export default function GeneralThemes({ title }) {
  const { t } = useTranslation("features");
  const { navigation } = useApp();
  const { setIsFilterOpen } = navigation;

  const { addressOptions } = useCurrentLocation();
  const weatherInfo = useCurrentWeatherV2();

  const { level, charging } = useBatteryStatus();
  const streak = useStreakStore((s) => s.streak);
  const postedMoments = useUploadQueueStore((s) => s.postedMoments);
  const authUser = useAuthStore((s) => s.user);
  const [locketCount, setLocketCount] = useState(1);

  const updateOverlayEditor = useOverlayEditorStore(
    (s) => s.updateOverlayEditor,
  );
  const resetOverlayEditor = useOverlayEditorStore((s) => s.resetOverlayEditor);

  const [time, setTime] = useState(new Date());
  const [savedAddressOptions, setSavedAddressOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // popup states
  const [popupActive, setPopupActive] = useState(false);
  const [formType, setFormType] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [spotifyPickerOpen, setSpotifyPickerOpen] = useState(false);

  const { dominantColor, palette } = useMediaPalette();

  // --- EFFECTS ---
  useEffect(() => {
    if (
      addressOptions.length &&
      JSON.stringify(addressOptions) !== JSON.stringify(savedAddressOptions)
    ) {
      setSavedAddressOptions(addressOptions);
    }
  }, [addressOptions]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Tổng số Locket (bài đăng web + cache moments của user)
  useEffect(() => {
    let cancelled = false;
    const posted = Array.isArray(postedMoments) ? postedMoments.length : 0;

    (async () => {
      let fromCache = 0;
      try {
        const uid = getMyLocalId(authUser);
        if (uid) {
          const mine = await getMomentsByUser(uid);
          fromCache = Array.isArray(mine) ? mine.length : 0;
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        setLocketCount(Math.max(posted, fromCache, 1));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postedMoments, authUser]);

  const formattedTime = useMemo(
    () =>
      time.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [time],
  );

  // --- CORE APPLY ---
  const applyOverlay = (data) => {
    resetOverlayEditor();

    updateOverlayEditor({
      ...data,
      color_top: data.color_top || "",
      color_bottom: data.color_bottom || "",
      text_color: data.text_color || "#FFFFFF",
      icon: data.icon || "",
      caption: data.caption || "",
      type: data.type || "default",
    });

    setIsFilterOpen(false);
  };

  // --- MUSIC ---
  const openMusicForm = (type) => {
    setFormType(type);
    requestAnimationFrame(() => setPopupActive(true));
  };

  const closeMusicForm = () => {
    setPopupActive(false);
    setTimeout(() => setFormType(""), 300);
  };

  /** Gắn caption music chuẩn Locket (từ link hoặc Spotify live) */
  const applyMusicOverlay = (musicData, platformHint = "spotify") => {
    if (!musicData?.title && !musicData?.song_name && !musicData?.song_title) {
      SonnerError(t("custom_studio.music_failed"));
      return false;
    }

    const caption =
      musicData.title ||
      [musicData.song_title || musicData.song_name, musicData.artist]
        .filter(Boolean)
        .join(" · ");

    const song_title =
      musicData.song_title ||
      musicData.song_name ||
      musicData.name ||
      "";
    const hasSpotify = Boolean(musicData.spotify_url);
    const hasApple = Boolean(
      musicData.apple_music_url || musicData.appleMusicUrl,
    );
    const isrc = normalizeIsrc(musicData.isrc);
    const musicPayload = {
      song_title,
      song_name: song_title,
      name: song_title,
      artist: musicData.artist || "",
      isrc,
      preview_url:
        musicData.preview_url ||
        musicData.previewUrl ||
        musicData.audio ||
        null,
      image_url: musicData.image_url || musicData.image || "",
      platform: hasSpotify
        ? "spotify"
        : hasApple
          ? "apple"
          : musicData.platform || platformHint,
    };
    // Platform links: badge ưu tiên Spotify nếu có; giữ Apple song song (iOS play)
    if (hasSpotify) musicPayload.spotify_url = musicData.spotify_url;
    if (hasApple) {
      musicPayload.apple_music_url =
        musicData.apple_music_url || musicData.appleMusicUrl;
    }

    if (!musicPayload.isrc) {
      console.warn(
        "[music] thiếu ISRC — Locket app không hiện nhạc",
        musicPayload,
      );
      SonnerError(
        "Không lấy được mã ISRC",
        "App Locket cần ISRC. Thử bài khác, dán link Spotify/Apple Music, hoặc tìm theo tên.",
      );
      return false;
    }
    if (!musicPayload.spotify_url && !musicPayload.apple_music_url) {
      SonnerError(
        "Thiếu link Apple Music / Spotify",
        "Chọn bài khác (có preview) — app Locket cần link để hiện nhạc.",
      );
      return false;
    }
    // iOS MusicKit: bắt buộc apple_music_url có ?i=trackId
    const appleOk =
      musicPayload.apple_music_url &&
      /[?&]i=\d{5,}/.test(String(musicPayload.apple_music_url));
    if (!appleOk) {
      SonnerError(
        "Thiếu link Apple Music (iOS)",
        "iPhone cần link Apple Music có mã bài (?i=). Thử dán link Apple Music hoặc chọn bản khác.",
      );
      return false;
    }
    if (!musicPayload.image_url) {
      SonnerError(
        "Thiếu ảnh bìa album",
        "Chọn lại bài có cover rồi gắn nhạc.",
      );
      return false;
    }

    applyOverlay({
      overlay_id: "caption:music",
      caption,
      text: caption,
      icon: {
        data: musicPayload.image_url,
        type: "image",
        source: "url",
      },
      type: "music",
      payload: musicPayload,
      platform: musicPayload.platform,
    });

    const dual =
      musicPayload.spotify_url && musicPayload.apple_music_url
        ? "Spotify + Apple Music"
        : musicPayload.apple_music_url ||
            musicPayload.platform === "apple" ||
            platformHint === "apple"
          ? "Apple Music"
          : "Spotify";
    const dualHint =
      musicPayload.spotify_url && musicPayload.apple_music_url
        ? "Android + iOS đều nghe được"
        : musicPayload.apple_music_url
          ? "iOS OK — thiếu Spotify (Android có thể không phát)"
          : musicPayload.spotify_url
            ? "Android OK — thiếu Apple (iOS có thể không phát)"
            : "";
    SonnerSuccess(
      dual,
      dualHint ||
        (musicPayload.preview_url
          ? t("custom_studio.music_success")
          : "Đã gắn nhạc (ISRC OK) — hiện trên web + app Locket."),
    );
    return true;
  };

  const handleMusicSubmit = async (link) => {
    setLoading(true);
    SonnerInfo("Đang lấy mã nhạc (ISRC)…", "Có thể mất vài giây");
    try {
      const platform = formType === "apple" ? "apple" : "spotify";
      // Multi-step resolve (chấp nhận chậm) — không chỉ 1 lần getInfo
      const musicData =
        platform === "spotify"
          ? await resolveMusicForLocket({
              spotify_url: link,
              song_title: "",
              artist: "",
            })
          : await getInfoMusicByUrl(link, "apple");

      const ok = applyMusicOverlay(musicData, platform);
      if (ok) closeMusicForm();
      else if (!musicData?.isrc) {
        SonnerError(
          "Không lấy được mã ISRC",
          "Thử bài khác, dán link track Spotify, hoặc tìm theo tên.",
        );
      }
    } catch {
      SonnerError(t("custom_studio.music_failed"));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Chọn bài — resolve ISRC chắc chắn (chấp nhận load lâu) rồi gắn.
   * Locket app chỉ hiện nhạc khi có isrc.
   */
  const handleSpotifyLivePick = async (track) => {
    if (
      !track?.spotify_url &&
      !track?.id &&
      !track?.song_name &&
      !track?.song_title &&
      !track?.preview_url &&
      !track?.musicTrackId &&
      !track?.audioUrl &&
      !track?.title
    ) {
      SonnerError(t("custom_studio.music_failed"));
      return;
    }
    setLoading(true);
    SonnerInfo("Đang lấy mã nhạc (ISRC)…", "Có thể mất vài giây");
    try {
      const raw = track._raw ? { ...track._raw, ...track } : track;

      const isLocalUpload =
        raw.source === "upload" ||
        raw.platform === "upload" ||
        (Boolean(raw.musicTrackId) &&
          !raw.spotify_url &&
          !raw._raw &&
          raw.source === "library");

      const songFromTrack =
        raw.song_title || raw.song_name || raw.title || raw.name || "";
      const artistFromTrack = raw.artist || "";

      // Local file
      if (isLocalUpload) {
        const preview = raw.preview_url || raw.audioUrl || raw.audio || null;
        const image_url = raw.image_url || raw.coverUrl || "";
        const endTime =
          Number(raw.endTime) ||
          (raw.duration_ms > 0
            ? raw.duration_ms / 1000
            : Number(raw.duration) || 30);
        const caption =
          [songFromTrack, artistFromTrack].filter(Boolean).join(" - ") ||
          songFromTrack ||
          "Nhạc";
        applyOverlay({
          overlay_id: "caption:music",
          caption,
          text: caption,
          icon: { data: image_url, type: "image", source: "url" },
          type: "music",
          payload: {
            song_title: songFromTrack,
            song_name: songFromTrack,
            name: songFromTrack,
            artist: artistFromTrack,
            isrc: raw.isrc || null,
            preview_url: preview,
            audio: preview,
            image_url,
            image: image_url,
            platform: "upload",
            musicTrackId: raw.musicTrackId || raw.id || null,
            startTime: 0,
            endTime: Math.max(1, endTime),
            volume: 1,
            originalVideoVolume: 1,
            duration: endTime,
          },
          platform: "upload",
        });
        setSpotifyPickerOpen(false);
        SonnerSuccess(
          "Đã gắn file nhạc",
          "App Locket chỉ hiện bài Spotify có ISRC — nên chọn từ tìm Spotify.",
        );
        return;
      }

      // Resolve ISRC + Apple ?i= từ tìm web — không bắt dán link
      let musicData = null;
      const rawIsrc = normalizeIsrc(raw.isrc);
      const hasPlatform = Boolean(raw.spotify_url || raw.apple_music_url);
      // Chỉ skip resolve khi đã có ISRC + Spotify + Apple playable
      if (
        rawIsrc &&
        hasPlatform &&
        isPlayableAppleMusicUrl(raw.apple_music_url) &&
        (raw.song_title || raw.song_name || raw.name || songFromTrack)
      ) {
        musicData = {
          song_title: songFromTrack,
          song_name: songFromTrack,
          name: songFromTrack,
          artist: artistFromTrack,
          isrc: rawIsrc,
          preview_url: raw.preview_url || raw.audioUrl || null,
          image_url: raw.image_url || raw.coverUrl || "",
          spotify_url: raw.spotify_url || null,
          apple_music_url: raw.apple_music_url || null,
          platform: raw.spotify_url ? "spotify" : "apple",
        };
      } else {
        musicData = await resolveMusicForLocket(raw);
        // Retry: bỏ feat/ngoặc + bỏ dấu
        if (!normalizeIsrc(musicData?.isrc || raw.isrc) && songFromTrack) {
          const cleaned = songFromTrack
            .replace(/\(.*?\)/g, " ")
            .replace(/\[.*?\]/g, " ")
            .replace(/\b(feat\.?|ft\.?|featuring|with)\s+.+$/i, " ")
            .replace(/\s+/g, " ")
            .trim();
          const bare = cleaned
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D");
          for (const titleTry of [cleaned, bare]) {
            if (!titleTry || titleTry === songFromTrack) continue;
            musicData = await resolveMusicForLocket({
              ...raw,
              song_title: titleTry,
              song_name: titleTry,
              title: titleTry,
              name: titleTry,
              isrc: null,
            });
            if (normalizeIsrc(musicData?.isrc)) break;
          }
        }
        // Lần cuối: search lại lấy bài CÓ ISRC gần tên
        if (!normalizeIsrc(musicData?.isrc || raw.isrc) && songFromTrack) {
          try {
            const q = [songFromTrack, artistFromTrack]
              .filter(Boolean)
              .join(" ");
            const hits = await searchMusicByQuery(q, 20);
            const hit = (hits || []).find((h) => normalizeIsrc(h.isrc));
            if (hit) {
              musicData = {
                ...(musicData || {}),
                ...hit,
                isrc: normalizeIsrc(hit.isrc),
                song_title:
                  hit.song_title || hit.song_name || songFromTrack,
                artist: hit.artist || artistFromTrack,
              };
            }
          } catch {
            /* keep */
          }
        }
      }

      const isrc = normalizeIsrc(musicData?.isrc || raw.isrc);
      if (!isrc) {
        SonnerError(
          "Bài này chưa có mã ISRC",
          "Chọn bản khác trong list (ưu tiên bản có dấu ✓), hoặc dán link Spotify/Apple Music.",
        );
        return;
      }

      const song_title =
        musicData?.song_title ||
        musicData?.song_name ||
        musicData?.name ||
        songFromTrack;
      const artist = musicData?.artist || artistFromTrack;
      const preview =
        musicData?.preview_url || raw.preview_url || raw.audioUrl || null;
      const image_url =
        musicData?.image_url || raw.image_url || raw.coverUrl || "";
      let finalSpotify = musicData?.spotify_url || raw.spotify_url || null;
      let apple_music_url =
        musicData?.apple_music_url || raw.apple_music_url || null;

      // Có ISRC nhưng thiếu link platform → search bù
      if (!finalSpotify && !apple_music_url) {
        try {
          const hits = await searchMusicByQuery(
            [song_title, artist].filter(Boolean).join(" "),
            10,
          );
          const hit = (hits || []).find(
            (h) =>
              normalizeIsrc(h.isrc) === isrc ||
              h.spotify_url ||
              h.apple_music_url,
          );
          if (hit) {
            finalSpotify = hit.spotify_url || finalSpotify;
            apple_music_url = hit.apple_music_url || apple_music_url;
          }
        } catch {
          /* keep */
        }
      }

      // App Locket: Spotify (Android) + Apple ?i= (iOS MusicKit)
      if (!finalSpotify && !apple_music_url) {
        SonnerError(
          "Thiếu link Apple Music / Spotify",
          "Thử gõ đúng tên bài + ca sĩ, chọn bản khác trong list.",
        );
        return;
      }
      // Bù Apple từ search list rồi iTunes (trình duyệt) — tìm web là đủ, không dán link
      if (!isPlayableAppleMusicUrl(apple_music_url)) {
        try {
          const hits = await searchMusicByQuery(
            [song_title, artist].filter(Boolean).join(" "),
            15,
          );
          const hit = (hits || []).find((h) =>
            isPlayableAppleMusicUrl(h.apple_music_url),
          );
          if (hit) {
            apple_music_url = hit.apple_music_url;
            finalSpotify = finalSpotify || hit.spotify_url || null;
          }
        } catch {
          /* keep */
        }
      }
      if (!isPlayableAppleMusicUrl(apple_music_url)) {
        const enriched = await ensureIosAppleOnTrack({
          song_title,
          artist,
          isrc,
          spotify_url: finalSpotify,
          apple_music_url,
          preview_url: preview,
          image_url,
        });
        apple_music_url = enriched.apple_music_url || apple_music_url;
        if (!preview && enriched.preview_url) {
          /* preview filled below via musicData path — set local */
        }
        if (enriched.preview_url) {
          musicData = { ...(musicData || {}), preview_url: enriched.preview_url };
        }
        if (enriched.image_url && !image_url) {
          /* image handled via const — use enriched below */
        }
      }
      // iTunes direct once more if still weak
      if (!isPlayableAppleMusicUrl(apple_music_url)) {
        const it = await lookupItunesForLocket(song_title, artist);
        if (it?.apple_music_url) {
          apple_music_url = it.apple_music_url;
          if (it.preview_url) {
            musicData = {
              ...(musicData || {}),
              preview_url: musicData?.preview_url || it.preview_url,
            };
          }
        }
      }
      if (!isPlayableAppleMusicUrl(apple_music_url)) {
        SonnerError(
          "Chưa lấy được bản iPhone (Apple Music)",
          "Gõ rõ tên + ca sĩ (vd: Tìm Em Hngle), chọn bản có ✓. Không cần dán link — thử bài khác nếu vẫn lỗi.",
        );
        return;
      }
      const imageFinal =
        image_url || musicData?.image_url || "";
      if (!imageFinal) {
        SonnerError("Thiếu ảnh bìa album", "Chọn lại bài có cover.");
        return;
      }

      const caption =
        [song_title, artist].filter(Boolean).join(" · ") || song_title;

      // Web: loop full preview — không cắt endTime=30 (hay = hết file → im sau 1 vòng)
      const clipStart = 0;
      const clipEnd = 0;

      const platform = finalSpotify ? "spotify" : "apple";
      const platformPayload = {
        ...(finalSpotify ? { spotify_url: finalSpotify } : {}),
        ...(apple_music_url ? { apple_music_url } : {}),
      };

      // Ưu tiên preview iTunes (ổn định); Deezer signed hay chết giữa chừng
      let webPreview =
        musicData?.preview_url || preview || null;
      if (
        webPreview &&
        /dzcdn\.net|hdnea=|cdnt-preview/i.test(String(webPreview)) &&
        musicData?.preview_url &&
        /itunes\.apple\.com|mzstatic/i.test(String(musicData.preview_url))
      ) {
        webPreview = musicData.preview_url;
      }

      // Cover ưu tiên Apple CDN (logo pill iOS); webPreview chỉ cho nghe thử trên web
      const coverForLocket =
        (/mzstatic\.com|scdn\.co/i.test(String(imageFinal)) && imageFinal) ||
        imageFinal;

      applyOverlay({
        overlay_id: "caption:music",
        caption,
        text: caption,
        icon: { data: coverForLocket, type: "image", source: "url" },
        type: "music",
        payload: {
          song_title,
          song_name: song_title,
          name: song_title,
          artist,
          isrc,
          // Web preview only — server KHÔNG forward preview_url lên Locket app
          preview_url: webPreview,
          audio: webPreview,
          image_url: coverForLocket,
          image: coverForLocket,
          // Apple trước trong object (spread order: Apple then Spotify)
          ...(apple_music_url ? { apple_music_url } : {}),
          ...(finalSpotify ? { spotify_url: finalSpotify } : {}),
          platform: apple_music_url ? "apple" : platform,
          startTime: clipStart,
          endTime: clipEnd,
          volume: 1,
          originalVideoVolume: 1,
          duration: 30,
        },
        platform: apple_music_url ? "apple" : platform,
      });

      setSpotifyPickerOpen(false);
      SonnerSuccess(
        `Đã gắn · ISRC ${isrc} · logo+play iPhone`,
        `${song_title}${artist ? ` · ${artist}` : ""}`,
      );
    } catch (e) {
      console.error("[handleSpotifyLivePick]", e);
      SonnerError(
        t("custom_studio.music_failed"),
        e?.response?.data?.message || e?.message || "",
      );
    } finally {
      setLoading(false);
    }
  };

  // --- REVIEW ---
  const handleReviewSubmit = ({ rating, text }) => {
    applyOverlay({
      overlay_id: "review",
      caption: text,
      text,
      type: "review",
      payload: { rating, comment: text },
    });
    setReviewOpen(false);
  };

  // --- ACTION MAP ---
  const actions = {
    default: () => applyOverlay({ type: "default" }),

    music: () => openMusicForm("spotify"),
    music_apple: () => openMusicForm("apple"),
    // Caption nhạc live (kiểu TikTok) — liên kết Spotify user
    music_spotify_live: () => setSpotifyPickerOpen(true),

    review: () => setReviewOpen(true),

    time: () =>
      applyOverlay({
        overlay_id: "time",
        icon: { color: "#FFFFFFCC", data: "clock.fill", type: "sf_symbol" },
        caption: formattedTime,
        text: formattedTime,
        type: "time",
      }),

    weather: () => {
      if (!weatherInfo || !weatherInfo.payload || !weatherInfo.text) {
        SonnerInfo(t("custom_studio.weather_no_data"));
        return;
      }

      applyOverlay({
        overlay_id: "weather",
        caption: weatherInfo?.text || {},
        type: "weather",
        ...weatherInfo,
      });
    },

    battery: () =>
      applyOverlay({
        overlay_id: "battery",
        caption: level || "50",
        icon: charging,
        text: `${level || "50"}%`,
        type: "battery",
      }),

    heart: () =>
      applyOverlay({
        overlay_id: "heart",
        caption: "inlove",
        text: "inlove",
        icon: { color: "#FF0000CC", data: "heart.fill", type: "sf_symbol" },
        type: "heart",
      }),

    // Caption Lockets — pill vàng + ♥ + tổng số Locket (khoe với bạn bè)
    locket_count: () => {
      const count = String(locketCount || 1);
      applyOverlay({
        overlay_id: "locket_count",
        icon: {
          color: "#00000099",
          data: "suit.heart.fill",
          type: "sf_symbol",
        },
        background: { colors: ["#FFD25F", "#EAA900"] },
        caption: count,
        text: count,
        type: "locket_count",
        text_color: "#00000099",
      });
    },

    streak: () =>
      applyOverlay({
        overlay_id: "streak",
        icon: { color: "#00000099", data: "flame.fill", type: "sf_symbol" },
        background: { colors: ["#FFD25F", "#EAA900"] },
        caption: streak?.count || "1",
        text: String(streak?.count || "1"),
        type: "streak",
        text_color: "#00000099",
      }),
    color_palette: () =>
      applyOverlay({
        overlay_id: "color_palette",
        icon: { source: "local", data: "color_palette_icon", type: "image" },
        background: { material_blur: "ultra_thin", colors: [] },
        caption: String(dominantColor || "#FFFFFF"),
        text: String(dominantColor || "#FFFFFF"),
        payload: { colors: palette || [] },
        type: "color_palette",
        text_color: "#FFFFFFE6",
      }),
    poll: () =>
      applyOverlay({
        overlay_id: "poll",
        background: { colors: ["#685AF7", "#685AF7"] },
        text: "",
        type: "poll",
        text_color: "#FFFFFFF0",
        payload: {
          right_emoji: "👎",
          left_emoji: "👍",
        },
      }),
  };

  const handleClick = (id) => actions[id]?.();

  // --- MUSIC META (fix thiếu props modal) ---
  const musicMeta = {
    icon:
      formType === "apple" ? (
        <img src="/svg/lcd-empty-logo.svg" className="w-8 h-8" />
      ) : (
        <img src="/icons/spotify_icon.png" className="w-8 h-8" />
      ),
    title: t("custom_studio.enter_link", {
      platform: formType === "apple" ? "Apple Music" : "Spotify",
    }),
  };

  // --- BUTTONS ---
  const buttons = [
    {
      id: "default",
      icon: <span className="mr-1 font-semibold">Aa</span>,
      label: t("custom_studio.text_label"),
    },
    {
      id: "locket_count",
      icon: (
        <img src="/icons/suit_heart_fill.png" className="w-5 h-5 mr-0.5" />
      ),
      label: String(locketCount || 1),
      background: ["#FFD25F", "#EAA900"],
      color: "#00000099",
    },
    {
      id: "color_palette",
      icon: (
        <img src="/icons/color_palette_icon.png" className="w-6 h-6 mr-1" />
      ),
      label: t("custom_studio.color_label"),
    },
    {
      id: "music",
      icon: <img src="/icons/music_icon.png" className="w-6 h-6 mr-1" />,
      label: "Spotify link",
    },
    {
      id: "music_spotify_live",
      icon: <Music2 className="w-5 h-5 mr-1" />,
      label: "Tìm nhạc",
      background: ["#FE2C55", "#25F4EE"],
      color: "#FFFFFF",
    },
    {
      id: "music_apple",
      icon: <img src="/svg/lcd-empty-logo.svg" className="w-5 h-5 mr-1" />,
      label: "Apple Music",
    },
    {
      id: "weather",
      icon: <IconRenderer icon={weatherInfo.icon} />,
      background: weatherInfo.background.colors,
      color: "#FFFFFF",
      label: weatherInfo?.text || t("custom_studio.weather_label"),
      cover: "/images/cloud_cover.png",
    },
    {
      id: "review",
      icon: <img src="/icons/star_icon.png" className="w-5 h-5 mr-1" />,
      label: "Review",
    },
    {
      id: "time",
      icon: <PiClockFill className="w-6 h-6 mr-1 rotate-270" />,
      label: formattedTime,
    },
    {
      id: "streak",
      icon: <img src="/icons/flame_fill.png" className="w-5 h-5 mr-0.5" />,
      label: streak?.count || "1",
      background: ["#FFD25F", "#EAA900"],
      color: "#00000099",
    },
    {
      id: "poll",
      background: ["#685AF7", "#685AF7"],
      icon: <img src="/icons/poll_icon.png" className="w-5 h-5 mr-0.5" />,
      color: "#FFFFFF",
      label: t("custom_studio.poll_label"),
    },
    {
      id: "location",
      icon: <LocationIcon className="w-6 h-6 mr-0.5" />,
      label: savedAddressOptions[0] || t("custom_studio.location_label"),
    },
  ];

  return (
    <>
      <div className="px-4">
        {title && (
          <div className="flex flex-row gap-3 items-center mb-2">
            <h2 className="text-md font-semibold text-primary">{title}</h2>
            <div className="badge badge-sm badge-secondary">New</div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-start">
          {buttons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => handleClick(btn.id)}
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.05)",
                ...getCaptionStyle(btn.background, btn.color),
              }}
              className={`relative flex flex-col whitespace-nowrap backdrop-blur-3xl items-center space-y-1 py-2 px-4 btn h-auto w-auto rounded-3xl font-semibold justify-center`}
            >
              {btn.cover && (
                <img
                  src={btn.cover}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  className="absolute inset-0 w-full h-full object-cover rounded-3xl select-none pointer-events-none"
                  style={{
                    opacity: weatherInfo?.payload?.cloud_cover ?? 0.35,
                  }}
                />
              )}
              <span className="text-base flex flex-row items-center gap-1 font-bold">
                {btn.icon}

                {btn.id === "location" ? (
                  <div className="relative w-max">
                    <div className="cursor-pointer select-none">
                      {savedAddressOptions[0] ||
                        t("custom_studio.location_label")}
                    </div>

                    <select
                      className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) =>
                        applyOverlay({
                          preset_id: "location",
                          caption: e.target.value,
                          type: "location",
                        })
                      }
                    >
                      <option value="" disabled>
                        {t("custom_studio.select_address")}
                      </option>
                      {savedAddressOptions.map((opt, idx) => (
                        <option key={idx} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  btn.label
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* POPUP MUSIC — dán link */}
      <FormMusicPoup
        open={popupActive}
        onClose={closeMusicForm}
        onConfirm={handleMusicSubmit}
        loading={loading}
        formType={formType}
        {...musicMeta}
      />

      {/* POPUP NHẠC LIVE — Spotify account (kiểu TikTok) */}
      <FormSpotifyPicker
        open={spotifyPickerOpen}
        onClose={() => !loading && setSpotifyPickerOpen(false)}
        onPick={handleSpotifyLivePick}
        loading={loading}
      />

      {/* POPUP REVIEW */}
      <FormReviewPoup
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onConfirm={handleReviewSubmit}
        title={"Caption Review"}
      />
    </>
  );
}
