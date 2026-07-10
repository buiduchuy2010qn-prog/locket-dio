// utils/themeUtils.js

/** Theme có nền gradient hồng + tuyết */
export const PINK_SNOW_THEME = "pinksnow";

export const isPinkSnowTheme = (theme) =>
  theme === PINK_SNOW_THEME || theme === "valentine";

export const applyTheme = (theme) => {
  const t = theme || PINK_SNOW_THEME;
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.classList.toggle("theme-pink-snow", isPinkSnowTheme(t));
  document.body?.classList.toggle("theme-pink-snow", isPinkSnowTheme(t));
  localStorage.setItem("theme", t);

  const computedStyle = getComputedStyle(document.documentElement);
  let baseColor =
    computedStyle.getPropertyValue("--color-base-100")?.trim() || "#ffc4dd";

  // pinksnow: thanh status bar hồng rõ
  if (t === PINK_SNOW_THEME) {
    baseColor = "#ff9ecf";
  }

  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.name = "theme-color";
    document.head.appendChild(metaTheme);
  }
  metaTheme.setAttribute("content", baseColor || "#ffc4dd");
};

