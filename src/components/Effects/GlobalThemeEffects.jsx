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

  // Camera / locket: vừa đủ tuyết, không làm lag preview
  const onCameraRoute =
    location.pathname.startsWith("/locket") ||
    location.pathname.startsWith("/camera");

  const intervalMs = onCameraRoute
    ? 160
    : theme === "pinksnow"
      ? 100
      : 140;
  const maxFlakes = onCameraRoute ? 28 : theme === "pinksnow" ? 48 : 36;

  return (
    <SnowEffect
      intervalMs={intervalMs}
      maxFlakes={maxFlakes}
      className={
        theme === "pinksnow" || theme === "valentine"
          ? "snow-layer--pink"
          : ""
      }
    />
  );
};

export default GlobalThemeEffects;
