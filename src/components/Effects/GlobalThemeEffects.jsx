import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import SnowEffect from "./SnowEffect";
import { hasSnowEffect, isPinkSnowTheme } from "@/utils/theme/themeUtils";

/**
 * Mưa tuyết toàn app khi theme: pinksnow | valentine | winter
 * pinksnow: hồng + tim + lấp lánh (đậm nhất)
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

  const isPink = isPinkSnowTheme(theme);
  const isPinkSnow = theme === "pinksnow";

  // pinksnow: tuyết dày + hồng; camera: giảm để mượt preview
  const intervalMs = onCameraRoute
    ? isPinkSnow
      ? 120
      : 160
    : isPinkSnow
      ? 70
      : isPink
        ? 90
        : 130;

  const maxFlakes = onCameraRoute
    ? isPinkSnow
      ? 36
      : 24
    : isPinkSnow
      ? 64
      : isPink
        ? 48
        : 32;

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
