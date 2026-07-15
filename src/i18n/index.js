import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import resourcesToBackend from "i18next-resources-to-backend";

const SUPPORTED_LNGS = ["vi", "en", "ja", "ko", "zh", "de"];

function resolveInitialLng() {
  try {
    const saved = localStorage.getItem("language");
    if (saved) {
      const code = saved.split("-")[0].toLowerCase();
      if (SUPPORTED_LNGS.includes(code)) return code;
    }
  } catch {
    /* ignore */
  }
  return undefined; // let detector / fallback handle
}

i18n
  .use(LanguageDetector)
  .use(
    resourcesToBackend((lng, ns) => {
      const code = String(lng || "vi").split("-")[0];
      const safe = SUPPORTED_LNGS.includes(code) ? code : "vi";
      return import(`@/locales/${safe}/${ns}.json`);
    }),
  )
  .use(initReactI18next)
  .init({
    ns: ["public", "main", "features", "auth"],
    defaultNS: "public",
    fallbackNS: "public",
    // Missing keys → same language only, then Vietnamese (never English
    // for non-EN locales — avoids half English / half local UI).
    fallbackLng: {
      ja: ["ja", "vi"],
      ko: ["ko", "vi"],
      zh: ["zh", "vi"],
      de: ["de", "vi"],
      en: ["en", "vi"],
      default: ["vi"],
    },
    supportedLngs: SUPPORTED_LNGS,
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    lng: resolveInitialLng(),
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "language",
      caches: ["localStorage"],
      convertDetectedLanguage: (lng) => {
        const code = String(lng || "").split("-")[0].toLowerCase();
        return SUPPORTED_LNGS.includes(code) ? code : "vi";
      },
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
