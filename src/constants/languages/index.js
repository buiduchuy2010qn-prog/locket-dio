export const LANGUAGES = [
  {
    code: "vi",
    flag: "🇻🇳",
    name: "Tiếng Việt",
    native: "Vietnamese",
  },
  {
    code: "en",
    flag: "🇺🇸",
    name: "English",
    native: "English",
  },
  {
    code: "zh",
    flag: "🇨🇳",
    name: "中文（简体）",
    native: "Chinese",
  },
  {
    code: "ko",
    flag: "🇰🇷",
    name: "한국어",
    native: "Korean",
  },
  {
    code: "de",
    flag: "🇩🇪",
    name: "Deutsch",
    native: "German",
  },
];

export const LANGUAGE_NAMES = Object.fromEntries(
  LANGUAGES.map(({ code, name, flag }) => [code, { name, flag }]),
);
