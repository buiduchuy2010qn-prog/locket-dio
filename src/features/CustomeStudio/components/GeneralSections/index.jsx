import React, { useEffect, useState, useMemo } from "react";
import { PiClockFill } from "react-icons/pi";
import { useApp } from "@/context/AppContext";
import { useBatteryStatus } from "@/utils";
import { getInfoMusicByUrl } from "@/services";
import {
  SonnerError,
  SonnerInfo,
  SonnerSuccess,
} from "@/components/ui/SonnerToast";
import { useTranslation } from "react-i18next";
import FormMusicPoup from "@/features/FormMusicPoup";
import FormSpotifyPicker from "@/features/FormSpotifyPicker";
import FormReviewPoup from "@/features/FormReviewPoup";
import { useOverlayEditorStore, useStreakStore } from "@/stores";
import IconRenderer from "@/components/Overlay/icons/IconRenderer";
import { getCaptionStyle } from "@/helpers/styleHelpers";
import {
  useCurrentWeatherV2,
  useCurrentLocation,
  useMediaPalette,
} from "../../hooks";
import LocationIcon from "@/assets/icons/LocationIcon";
import { Music2 } from "lucide-react";

export default function GeneralThemes({ title }) {
  const { t } = useTranslation("features");
  const { navigation } = useApp();
  const { setIsFilterOpen } = navigation;

  const { addressOptions } = useCurrentLocation();
  const weatherInfo = useCurrentWeatherV2();

  const { level, charging } = useBatteryStatus();
  const streak = useStreakStore((s) => s.streak);

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
        .join(" - ");

    const musicPayload = {
      ...musicData,
      song_title:
        musicData.song_title ||
        musicData.song_name ||
        musicData.name ||
        "",
      song_name:
        musicData.song_name ||
        musicData.song_title ||
        musicData.name ||
        "",
      artist: musicData.artist || "",
      isrc: musicData.isrc || null,
      preview_url:
        musicData.preview_url ||
        musicData.previewUrl ||
        musicData.audio ||
        null,
      image_url: musicData.image_url || musicData.image || "",
      platform: musicData.platform || platformHint,
      spotify_url: musicData.spotify_url || null,
    };

    if (!musicPayload.isrc) {
      console.warn(
        "[music] thiếu ISRC — Locket app có thể không hiện nhạc",
        musicPayload,
      );
      SonnerError(
        "Không lấy được mã ISRC bài hát. Thử bài khác hoặc dán link Spotify.",
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

    SonnerSuccess(
      platformHint === "apple" ? "Apple Music" : "Spotify",
      musicPayload.preview_url
        ? t("custom_studio.music_success")
        : "Đã gắn nhạc (ISRC OK). Preview web có thể im — app Locket vẫn hiện.",
    );
    return true;
  };

  const handleMusicSubmit = async (link) => {
    setLoading(true);
    try {
      const musicData = await getInfoMusicByUrl(
        link,
        formType === "apple" ? "apple" : "spotify",
      );
      const ok = applyMusicOverlay(
        musicData,
        formType === "apple" ? "apple" : "spotify",
      );
      if (ok) closeMusicForm();
    } catch {
      SonnerError(t("custom_studio.music_failed"));
    } finally {
      setLoading(false);
    }
  };

  /** Chọn bài từ tìm kiếm (không liên kết tài khoản) */
  const handleSpotifyLivePick = async (track) => {
    if (!track?.spotify_url && !track?.id && !track?.song_name) {
      SonnerError(t("custom_studio.music_failed"));
      return;
    }
    setLoading(true);
    try {
      const url =
        track.spotify_url ||
        (track.id && String(track.source || "").includes("spotify")
          ? `https://open.spotify.com/track/${track.id}`
          : track.id && track.source !== "deezer-search"
            ? `https://open.spotify.com/track/${track.id}`
            : null);

      let musicData = null;
      if (url) {
        try {
          musicData = await getInfoMusicByUrl(url, "spotify");
        } catch {
          musicData = null;
        }
      }

      const merged = {
        ...(track || {}),
        ...(musicData || {}),
        song_title:
          musicData?.song_title ||
          musicData?.song_name ||
          track.song_title ||
          track.song_name,
        song_name:
          musicData?.song_name || track.song_name || track.song_title,
        artist: musicData?.artist || track.artist || "",
        isrc: musicData?.isrc || track.isrc || null,
        preview_url: musicData?.preview_url || track.preview_url || null,
        image_url: musicData?.image_url || track.image_url || "",
        spotify_url: url || musicData?.spotify_url || null,
        platform: "spotify",
        title:
          musicData?.title ||
          track.title ||
          [track.song_title || track.song_name, track.artist]
            .filter(Boolean)
            .join(" - "),
      };

      const caption =
        merged.title ||
        [merged.song_title || merged.song_name, merged.artist]
          .filter(Boolean)
          .join(" - ");

      if (!caption) {
        SonnerError(t("custom_studio.music_failed"));
        return;
      }

      // Gắn luôn — server ensureMusic bổ sung ISRC khi đăng nếu thiếu
      applyOverlay({
        overlay_id: "caption:music",
        caption,
        text: caption,
        icon: {
          data: merged.image_url,
          type: "image",
          source: "url",
        },
        type: "music",
        payload: {
          ...merged,
          song_title: merged.song_title || merged.song_name || "",
          song_name: merged.song_name || merged.song_title || "",
          artist: merged.artist || "",
          isrc: merged.isrc || null,
          preview_url: merged.preview_url || null,
          image_url: merged.image_url || "",
          spotify_url: merged.spotify_url || null,
          platform: "spotify",
        },
        platform: "spotify",
      });

      SonnerSuccess(
        "Tìm nhạc",
        merged.isrc
          ? t("custom_studio.music_success")
          : "Đã gắn nhạc — server sẽ bổ sung ISRC khi đăng nếu cần.",
      );
      setSpotifyPickerOpen(false);
    } catch {
      SonnerError(t("custom_studio.music_failed"));
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

    locket_count: () => SonnerInfo("Sắp ra mắt!"),

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
      label: streak?.count || "1",
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
