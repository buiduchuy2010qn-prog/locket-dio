import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/hooks/useTheme";
import SnowEffect from "./SnowEffect";
import {
  hasSnowEffect,
  isPinkSnowTheme,
  getSnowIntensity,
} from "@/utils/theme/themeUtils";
import { getPerfProfile } from "@/utils/device/perfProfile";

/**
 * Tuyết canvas — không che camera gesture (pointer-events: none).
 * Intensity: off | light | normal (localStorage huy-locket-snow-intensity).
 */
const GlobalThemeEffects = () => {
  const { theme, snowIntensity } = useTheme();
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

  const intensity = snowIntensity || getSnowIntensity();
  const snowTheme = hasSnowEffect(theme);

  const onCameraRoute =
    location.pathname.startsWith("/locket") ||
    location.pathname.startsWith("/camera");

  const cfg = useMemo(() => {
    if (!snowTheme || intensity === "off") {
      return { enabled: false, maxFlakes: 0, staticOnly: false };
    }
    const p = getPerfProfile();
    const isPink = isPinkSnowTheme(theme);

    // reduced motion → few static flakes only
    if (reduceMotion) {
      return { enabled: true, maxFlakes: 8, staticOnly: true, pinkMode: isPink };
    }

    let max = intensity === "normal" ? 42 : 24;
    if (p.isMobile) max = intensity === "normal" ? 26 : 20;
    if (p.isLowEnd || p.isAndroid) max = intensity === "normal" ? 18 : 14;
    if (onCameraRoute) {
      // Keep camera smooth — always light on camera
      max = Math.min(max, p.isLowEnd || p.isAndroid ? 12 : 18);
    }
    // hard cap
    max = Math.min(60, Math.max(10, max));

    return {
      enabled: true,
      maxFlakes: max,
      staticOnly: false,
      pinkMode: isPink,
    };
  }, [snowTheme, intensity, theme, reduceMotion, onCameraRoute]);

  if (!cfg.enabled || hidden) return null;

  return (
    <SnowEffect
      maxFlakes={cfg.maxFlakes}
      pinkMode={cfg.pinkMode}
      staticOnly={cfg.staticOnly}
      className={cfg.pinkMode ? "snow-layer--pink" : ""}
    />
  );
};

export default GlobalThemeEffects;
