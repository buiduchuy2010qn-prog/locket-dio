import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import SnowEffect from "./SnowEffect";
import { hasSnowEffect, isPinkSnowTheme } from "@/utils/theme/themeUtils";
import { getSnowPerfConfig } from "@/utils/device/perfProfile";

/**
 * Mưa tuyết — Android/lite: rất nhẹ (hoặc tắt trên camera).
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

  if (!hasSnowEffect(theme) || hidden || reduceMotion) return null;

  const onCameraRoute =
    location.pathname.startsWith("/locket") ||
    location.pathname.startsWith("/camera");

  // Camera: tắt tuyết hẳn — tránh DOM append/remove đụng React khi mở cam
  if (onCameraRoute) return null;

  const isPink = isPinkSnowTheme(theme);
  const isPinkSnow = theme === "pinksnow";

  const cfg = getSnowPerfConfig({ onCameraRoute, isPinkSnow, isPink });
  if (!cfg.enabled) return null;

  // Premium visuals only for pinksnow (not valentine/winter)
  const premium = isPinkSnow && !cfg.lite;

  return (
    <SnowEffect
      intervalMs={cfg.intervalMs}
      maxFlakes={cfg.maxFlakes}
      pinkMode={(isPink || isPinkSnow) && !cfg.lite}
      premium={premium}
      lite={cfg.lite}
      className={[
        isPink || isPinkSnow ? "snow-layer--pink" : "",
        premium ? "snow-layer--premium" : "",
        // lite pinksnow still marks premium for slightly brighter lite CSS
        isPinkSnow && cfg.lite ? "snow-layer--premium" : "",
        cfg.lite ? "snow-layer--lite" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
};

export default GlobalThemeEffects;
