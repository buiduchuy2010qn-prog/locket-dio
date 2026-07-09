// utils/themeUtils.js
export const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);

  const computedStyle = getComputedStyle(document.documentElement);
  const baseColor =
    computedStyle.getPropertyValue("--color-base-100")?.trim() || "#ffc4dd";

  let metaTheme = document.querySelector('meta[name="theme-color"]');
  if (!metaTheme) {
    metaTheme = document.createElement("meta");
    metaTheme.name = "theme-color";
    document.head.appendChild(metaTheme);
  }
  // Ưu tiên hồng Locket cho thanh status điện thoại
  metaTheme.setAttribute("content", baseColor || "#ffc4dd");
};
