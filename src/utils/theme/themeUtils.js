// utils/themeUtils.js
import { CONFIG } from "@/config/webConfig";

/** DaisyUI theme id — Hồng tuyết */
export const PINK_SNOW_THEME = "pinksnow";
/** User-facing storage key values */
export const HUY_THEME_KEY = "huy-locket-theme";
export const HUY_SNOW_KEY = "huy-locket-snow-intensity";
export const HUY_THEME_DEFAULT = "default";
export const HUY_THEME_PINK_SNOW = "pink-snow";

/** Theme bật hiệu ứng tuyết rơi */
export const SNOW_THEME_IDS = new Set(["pinksnow", "pink-snow", "valentine", "winter"]);

export const isPinkSnowTheme = (theme) =>
  theme === PINK_SNOW_THEME ||
  theme === HUY_THEME_PINK_SNOW ||
  theme === "valentine";

export const hasSnowEffect = (theme) => SNOW_THEME_IDS.has(theme);

/** off | light | normal — default light */
export function getSnowIntensity() {
  try {
    const v = localStorage.getItem(HUY_SNOW_KEY);
    if (v === "off" || v === "light" || v === "normal") return v;
  } catch {
    /* ignore */
  }
  return "light";
}

export function setSnowIntensity(level) {
  const v =
    level === "off" || level === "normal" || level === "light" ? level : "light";
  try {
    localStorage.setItem(HUY_SNOW_KEY, v);
  } catch {
    /* ignore */
  }
  try {
    document.documentElement.dataset.snowIntensity = v;
  } catch {
    /* ignore */
  }
  return v;
}

/** Resolve daisyUI theme id from storage (legacy + huy-locket-theme) */
export function resolveStoredTheme() {
  try {
    const huy = localStorage.getItem(HUY_THEME_KEY);
    if (huy === HUY_THEME_PINK_SNOW || huy === "pinksnow") {
      return PINK_SNOW_THEME;
    }
    if (huy === HUY_THEME_DEFAULT) {
      // Prefer last non-pink daisy theme if any
      const legacy = localStorage.getItem("theme");
      if (legacy && !isPinkSnowTheme(legacy)) return legacy;
      return "light";
    }
    const legacy = localStorage.getItem("theme");
    if (legacy) return legacy;
  } catch {
    /* ignore */
  }
  return PINK_SNOW_THEME;
}

/** Tên hiển thị đẹp trong Settings */
export function getThemeLabel(themeId) {
  const labels = CONFIG?.ui?.themeLabels || {};
  if (labels[themeId]) return labels[themeId];
  if (themeId === HUY_THEME_PINK_SNOW) return labels.pinksnow || "Hồng Tuyết";
  return themeId;
}

/**
 * Apply theme to document before/after React paint.
 * DaisyUI id stays "pinksnow"; also sync huy-locket-theme.
 */
export const applyTheme = (theme) => {
  const t = theme || resolveStoredTheme() || PINK_SNOW_THEME;
  const root = document.documentElement;

  root.setAttribute("data-theme", t);
  // Alias for user-facing pink-snow naming
  if (t === PINK_SNOW_THEME) {
    root.dataset.huyTheme = HUY_THEME_PINK_SNOW;
  } else {
    root.dataset.huyTheme = HUY_THEME_DEFAULT;
  }

  root.classList.toggle("theme-pink-snow", isPinkSnowTheme(t));
  document.body?.classList.toggle("theme-pink-snow", isPinkSnowTheme(t));

  try {
    localStorage.setItem("theme", t);
    localStorage.setItem(
      HUY_THEME_KEY,
      isPinkSnowTheme(t) && t !== "valentine" && t !== "winter"
        ? HUY_THEME_PINK_SNOW
        : HUY_THEME_DEFAULT,
    );
  } catch {
    /* ignore */
  }

  // Snow intensity attribute for CSS/hooks
  const intensity = getSnowIntensity();
  root.dataset.snowIntensity = intensity;

  const computedStyle = getComputedStyle(root);
  let baseColor =
    computedStyle.getPropertyValue("--color-base-100")?.trim() || "#ffc4dd";

  if (t === PINK_SNOW_THEME) {
    baseColor = "#ff5fa8";
  } else if (t === "valentine") {
    baseColor = "#ff6b9d";
  }

  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.name = "theme-color";
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute("content", baseColor || "#ffc4dd");
};

/** Early boot (index.html / main.jsx) — no React */
export function bootThemeEarly() {
  try {
    const t = resolveStoredTheme();
    applyTheme(t);
  } catch {
    /* ignore */
  }
}
