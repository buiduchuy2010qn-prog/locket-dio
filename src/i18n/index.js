import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import resourcesToBackend from "i18next-resources-to-backend";

i18n
  .use(LanguageDetector)
  .use(resourcesToBackend((lng, ns) => import(`@/locales/${lng}/${ns}.json`)))
  .use(initReactI18next)
  .init({
    ns: ["public", "main", "features", "auth"],

    defaultNS: "public",

    fallbackNS: "public",

    fallbackLng: "vi",

    lng: localStorage.getItem("language") || undefined,

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "language",
      caches: ["localStorage"],
    },
  });

export default i18n;
