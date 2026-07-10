import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import SnowEffect from "./SnowEffect";

/** Theme bật hiệu ứng tuyết rơi */
export const SNOW_THEMES = new Set(["pinksnow", "valentine", "winter"]);

/**
 * Tuyết toàn app — pinksnow: hồng + tim + lấp lánh.
 * /locket: giảm mật độ để camera mượt.
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

  const onCameraRoute =
    location.pathname.startsWith("/locket") ||
    location.pathname.startsWith("/camera");

  const isPink = theme === "pinksnow" || theme === "valentine";

  const intervalMs = onCameraRoute ? 150 : isPink ? 85 : 130;
  const maxFlakes = onCameraRoute ? 26 : isPink ? 52 : 34;

  return (
    <SnowEffect
      intervalMs={intervalMs}
      maxFlakes={maxFlakes}
      pinkMode={isPink}
      className={isPink ? "snow-layer--pink" : ""}
    />
  );
};

export default GlobalThemeEffects;
