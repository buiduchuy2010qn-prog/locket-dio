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
} from "@/utils/theme/themeUtils";

const SNOW_LEVELS = [
  { id: "off", label: "Tắt" },
  { id: "light", label: "Nhẹ" },
  { id: "normal", label: "Bình thường" },
];

const ThemeViewSelect = () => {
  const { t } = useTranslation("auth");
  const { theme, changeTheme, snowIntensity, changeSnowIntensity } = useTheme();
  const activeIndex = CONFIG.ui.themes.indexOf(theme);
  const isPinkSnow = theme === PINK_SNOW_THEME;

  const [swiper, setSwiper] = useState(null);

  useEffect(() => {
    if (swiper && activeIndex >= 0) {
      swiper.slideTo(activeIndex);
    }
  }, [activeIndex, swiper]);

  return (
    <div className="w-full flex justify-center overflow-hidden">
      <div className="h-full max-w-md w-full px-1">
        <h1 className="font-lovehouse text-base-content text-center text-3xl font-semibold">
          {t("settings.theme_selector.title")}
        </h1>
        <p className="text-center text-xs text-base-content/60 mt-1 px-4">
          Chọn{" "}
          <span className="font-semibold text-primary">Hồng Tuyết ❄</span> để
          bật nền trắng–hồng mềm + tuyết rơi
        </p>

        {/* Quick: Mặc định / Hồng Tuyết */}
        <div className="flex justify-center gap-2 mt-3 px-4">
          <button
            type="button"
            onClick={() => changeTheme("light")}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
              !isPinkSnow
                ? "bg-primary text-primary-content border-primary"
                : "bg-base-100/80 border-base-300 text-base-content"
            }`}
          >
            Mặc định
          </button>
          <button
            type="button"
            onClick={() => changeTheme(PINK_SNOW_THEME)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
              isPinkSnow
                ? "bg-primary text-primary-content border-primary"
                : "bg-base-100/80 border-base-300 text-base-content"
            }`}
          >
            Hồng Tuyết
          </button>
        </div>

        {isPinkSnow && (
          <div className="mt-3 mx-4 p-3 rounded-2xl bg-base-100/80 border border-base-300/60">
            <p className="text-xs font-semibold text-base-content/80 mb-2">
              Hiệu ứng tuyết
            </p>
            <div className="flex gap-2 flex-wrap">
              {SNOW_LEVELS.map((lv) => (
                <button
                  key={lv.id}
                  type="button"
                  onClick={() => changeSnowIntensity?.(lv.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
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
              Mặc định: Nhẹ · Camera tự giảm particle để mượt
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
