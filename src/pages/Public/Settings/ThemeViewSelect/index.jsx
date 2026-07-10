import "swiper/css";
import "swiper/css/effect-coverflow";
import { CONFIG } from "@/config";
import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow } from "swiper/modules";
import { useTranslation } from "react-i18next";
import { getThemeLabel, hasSnowEffect } from "@/utils/theme/themeUtils";

const ThemeViewSelect = () => {
  const { t } = useTranslation("auth");
  const { theme, changeTheme } = useTheme();
  const activeIndex = CONFIG.ui.themes.indexOf(theme);

  const [swiper, setSwiper] = useState(null);

  useEffect(() => {
    if (swiper && activeIndex >= 0) {
      swiper.slideTo(activeIndex);
    }
  }, [activeIndex, swiper]);

  return (
    <div className="w-full flex justify-center overflow-hidden">
      <div className="h-full max-w-md">
        <h1 className="font-lovehouse text-base-content text-center text-3xl font-semibold">
          {t("settings.theme_selector.title")}
        </h1>
        <p className="text-center text-xs text-base-content/60 mt-1 px-4">
          Chọn <span className="font-semibold text-primary">Hồng tuyết ❄</span>{" "}
          để bật nền hồng + mưa tuyết
        </p>

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
                      <div className="absolute inset-0 bg-gradient-to-b from-pink-200/80 to-pink-300/60 flex items-center justify-center text-3xl">
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
