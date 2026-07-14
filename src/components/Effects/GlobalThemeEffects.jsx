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

  return (
    <SnowEffect
      intervalMs={cfg.intervalMs}
      maxFlakes={cfg.maxFlakes}
      pinkMode={isPink && !cfg.lite}
      lite={cfg.lite}
      className={`${isPink ? "snow-layer--pink" : ""} ${cfg.lite ? "snow-layer--lite" : ""}`.trim()}
    />
  );
};

export default GlobalThemeEffects;
