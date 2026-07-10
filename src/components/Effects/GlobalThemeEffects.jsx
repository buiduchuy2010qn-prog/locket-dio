import React from "react";
import { useTheme } from "@/hooks/useTheme";
import SnowEffect from "./SnowEffect";

/** Theme bật hiệu ứng tuyết rơi */
export const SNOW_THEMES = new Set(["pinksnow", "valentine", "winter"]);

/**
 * Hiệu ứng theo theme (toàn app): tuyết rơi trên nền hồng pinksnow.
 */
const GlobalThemeEffects = () => {
  const { theme } = useTheme();
  const showSnow = SNOW_THEMES.has(theme);

  if (!showSnow) return null;

  return (
    <SnowEffect
      intervalMs={theme === "pinksnow" ? 70 : 110}
      maxFlakes={theme === "pinksnow" ? 60 : 40}
      className={theme === "pinksnow" ? "snow-layer--pink" : ""}
    />
  );
};

export default GlobalThemeEffects;
