import "swiper/css";
import "swiper/css/effect-coverflow";
import { CONFIG } from "@/config";
import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow } from "swiper/modules";
import { useTranslation } from "react-i18next";
import {
  getThemeLabel,
  hasSnowEffect,
  PINK_SNOW_THEME,
  GLASS_THEME,
  isGlassTheme,
  isPinkSnowTheme,
} from "@/utils/theme/themeUtils";

const SNOW_LEVELS = [
  { id: "off", label: "Tắt" },
  { id: "light", label: "Nhẹ" },
  { id: "normal", label: "Bình thường" },
];

const QUICK = [
  { id: "light", label: "Mặc định", theme: "light" },
  { id: "pink", label: "Hồng Tuyết", theme: PINK_SNOW_THEME },
  { id: "glass", label: "Glass", theme: GLASS_THEME },
];

const ThemeViewSelect = () => {
  const { t } = useTranslation("auth");
  const { theme, changeTheme, snowIntensity, changeSnowIntensity } = useTheme();
  const activeIndex = CONFIG.ui.themes.indexOf(theme);
  const isPinkSnow = isPinkSnowTheme(theme) && theme !== "valentine";
  const isGlass = isGlassTheme(theme);

  const [swiper, setSwiper] = useState(null);

  useEffect(() => {
    if (swiper && activeIndex >= 0) {
      swiper.slideTo(activeIndex);
    }
  }, [activeIndex, swiper]);

  const quickActive = (q) => {
    if (q.id === "pink") return isPinkSnow;
    if (q.id === "glass") return isGlass;
    return !isPinkSnow && !isGlass;
  };

  return (
    <div className="w-full flex justify-center overflow-hidden">
      <div className="h-full max-w-md w-full px-1">
        <h1 className="font-lovehouse text-base-content text-center text-3xl font-semibold">
          {t("settings.theme_selector.title")}
        </h1>
        <p className="text-center text-xs text-base-content/60 mt-1 px-4">
          <span className="font-semibold text-primary">Hồng Tuyết</span> · tuyết ·{" "}
          <span className="font-semibold">Glass</span> · trong mờ mượt
        </p>

        {/* Quick: Mặc định / Hồng Tuyết / Glass */}
        <div className="flex justify-center gap-2 mt-3 px-3 flex-wrap">
          {QUICK.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => changeTheme(q.theme)}
              className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition ${
                quickActive(q)
                  ? "bg-primary text-primary-content border-primary"
                  : "bg-base-100/80 border-base-300 text-base-content"
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>

        {isPinkSnow && (
          <div className="mt-3 mx-4 p-3 rounded-2xl bg-base-100/80 border border-base-300/60 glassSurface">
            <p className="text-xs font-semibold text-base-content/80 mb-2">
              Hiệu ứng tuyết
            </p>
            <div className="flex gap-2 flex-wrap">
              {SNOW_LEVELS.map((lv) => (
                <button
                  key={lv.id}
                  type="button"
                  onClick={() => changeSnowIntensity?.(lv.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition glassButton ${
                    (snowIntensity || "light") === lv.id
                      ? "bg-primary text-primary-content border-primary"
                      : "bg-base-200/80 border-base-300 text-base-content/80"
                  }`}
                >
                  {lv.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-base-content/50 mt-2">
              Mặc định: Nhẹ · Camera tự giảm particle
            </p>
          </div>
        )}

        {isGlass && (
          <div className="mt-3 mx-4 p-3 rounded-2xl glassSurface text-center">
            <p className="text-xs font-semibold text-base-content/80">
              Theme Glass — blur chỉ trên chrome UI, không đụng camera
            </p>
          </div>
        )}

        <Swiper
          direction="horizontal"
          modules={[EffectCoverflow]}
          effect={"coverflow"}
          onSwiper={setSwiper}
          initialSlide={activeIndex >= 0 ? activeIndex : 0}
          centeredSlides={true}
          coverflowEffect={{
            rotate: 50,
            stretch: 20,
            depth: 100,
            modifier: 1,
            slideShadows: false,
          }}
          slidesPerView={2}
          spaceBetween={20}
          className="w-full mt-4 px-3"
        >
          {CONFIG.ui.themes.map((themeId) => {
            const isActive = theme === themeId;
            const label = getThemeLabel(themeId);
            const snow = hasSnowEffect(themeId);

            return (
              <SwiperSlide key={themeId}>
                <div
                  onClick={() => changeTheme(themeId)}
                  data-theme={themeId}
                  className={`relative 
                    flex flex-col justify-between items-center
                    aspect-[9/16] gap-3 space-y-3 w-full py-1
                    rounded-3xl
                    bg-base-100
                    transition-all duration-300 cursor-pointer
                    ${
                      isActive
                        ? "outline-2 outline-primary scale-95 shadow-lg shadow-primary/20"
                        : "hover:scale-[0.98]"
                    }
                  `}
                >
                  {snow && (
                    <span className="absolute top-2 right-2 z-10 text-sm bg-primary/15 rounded-full px-1.5 py-0.5">
                      ❄
                    </span>
                  )}
                  {themeId === "glass" && (
                    <span className="absolute top-2 right-2 z-10 text-[10px] font-bold bg-white/50 rounded-full px-1.5 py-0.5">
                      glass
                    </span>
                  )}

                  <div className="w-full flex flex-row justify-between items-center p-2 relative">
                    <div className="w-6 h-6 bg-base-300 rounded-full" />
                    <div className="absolute mx-auto left-1/2 -translate-x-1/2 w-20 h-6 rounded-2xl bg-base-300" />
                    <div className="flex flex-row gap-1">
                      <div className="w-6 h-6 bg-base-300 rounded-full" />
                      <div className="w-6 h-6 bg-base-300 rounded-full" />
                    </div>
                  </div>

                  <div className="w-full aspect-square bg-base-200 rounded-4xl relative overflow-hidden">
                    {themeId === "pinksnow" && (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-2xl"
                        style={{
                          background:
                            "linear-gradient(145deg,#fff 0%,#fff 44%,#fff0f7 58%,#ffc9e1 100%)",
                        }}
                      >
                        ❄
                      </div>
                    )}
                    {themeId === "glass" && (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-600"
                        style={{
                          background:
                            "radial-gradient(circle at 20% 20%,rgba(145,188,255,.35),transparent 40%),linear-gradient(145deg,#f8fbff,#e9f0f8 52%,#f8eef5)",
                        }}
                      >
                        ✦ glass
                      </div>
                    )}
                  </div>

                  <div className="w-full flex flex-row justify-between items-center px-6">
                    <div className="w-6 h-6 bg-base-300 rounded-full" />
                    <div className="w-9 h-9 rounded-full ring-2 text-primary flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full camera-inner-circle" />
                    </div>
                    <div className="w-6 h-6 bg-base-300 rounded-full" />
                  </div>

                  <div className="flex flex-row gap-1 items-center justify-center p-1">
                    <div className="w-4 h-4 rounded-2xl bg-base-300" />
                    <div className="w-10 h-4 rounded-2xl bg-base-300" />
                  </div>
                  <div className="h-[3px] bg-base-300 w-15 rounded-2xl"></div>
                </div>
                <div
                  className={`mt-2 text-center text-sm font-semibold ${
                    isActive ? "text-primary" : "text-base-content/70"
                  }`}
                >
                  {label}
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </div>
  );
};

export default ThemeViewSelect;
