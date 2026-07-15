// utils/themeUtils.js
import { CONFIG } from "@/config/webConfig";

/** Theme hồng + mưa tuyết (mặc định Huy Locket) */
export const PINK_SNOW_THEME = "pinksnow";

/** Theme bật hiệu ứng tuyết rơi */
export const SNOW_THEME_IDS = new Set(["pinksnow", "valentine", "winter"]);

export const isPinkSnowTheme = (theme) =>
  theme === PINK_SNOW_THEME || theme === "valentine";

export const hasSnowEffect = (theme) => SNOW_THEME_IDS.has(theme);

/** Tên hiển thị đẹp trong Settings */
export function getThemeLabel(themeId) {
  const labels = CONFIG?.ui?.themeLabels || {};
  if (labels[themeId]) return labels[themeId];
  return themeId;
}

export const applyTheme = (theme) => {
  const t = theme || PINK_SNOW_THEME;
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.classList.toggle(
    "theme-pink-snow",
    isPinkSnowTheme(t),
  );
  document.body?.classList.toggle("theme-pink-snow", isPinkSnowTheme(t));
  localStorage.setItem("theme", t);

  const computedStyle = getComputedStyle(document.documentElement);
  let baseColor =
    computedStyle.getPropertyValue("--color-base-100")?.trim() || "#ffc4dd";

  // pinksnow: status bar hồng tươi hơn (khớp gradient dreamy)
  if (t === PINK_SNOW_THEME) {
    baseColor = "#ff7ab8";
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

