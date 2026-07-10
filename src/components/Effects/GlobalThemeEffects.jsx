import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import SnowEffect from "./SnowEffect";

/** Theme bật hiệu ứng tuyết rơi */
export const SNOW_THEMES = new Set(["pinksnow", "valentine", "winter"]);

/**
 * Tuyết toàn app — giảm mạnh trên /locket (camera) để tránh khựng preview.
 */
const GlobalThemeEffects = () => {
  const { theme } = useTheme();
  const location = useLocation();
  const [hidden, setHidden] = useState(
    typeof document !== "undefined" ? document.hidden : false,
  );
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const applyMq = () => setReduceMotion(Boolean(mq?.matches));
    applyMq();
    mq?.addEventListener?.("change", applyMq);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      mq?.removeEventListener?.("change", applyMq);
    };
  }, []);

  if (!SNOW_THEMES.has(theme) || hidden || reduceMotion) return null;

  // Camera / locket screen: ít tuyết hơn hẳn (ưu tiên mượt stream)
  const onCameraRoute =
    location.pathname.startsWith("/locket") ||
    location.pathname.startsWith("/camera");

  const intervalMs = onCameraRoute
    ? 220
    : theme === "pinksnow"
      ? 140
      : 180;
  const maxFlakes = onCameraRoute ? 18 : theme === "pinksnow" ? 32 : 24;

  return (
    <SnowEffect
      intervalMs={intervalMs}
      maxFlakes={maxFlakes}
      className={theme === "pinksnow" ? "snow-layer--pink" : ""}
    />
  );
};

export default GlobalThemeEffects;
