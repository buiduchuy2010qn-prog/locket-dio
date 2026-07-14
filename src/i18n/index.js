import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import resourcesToBackend from "i18next-resources-to-backend";

i18n
  .use(LanguageDetector)
  .use(resourcesToBackend((lng, ns) => import(`@/locales/${lng}/${ns}.json`)))
  .use(initReactI18next)
  .init({
    // Chỉ load public lúc boot — main/auth/features load khi page cần (nhanh mobile)
    ns: ["public"],
    defaultNS: "public",
    fallbackNS: "public",
    fallbackLng: "vi",
    // partial: không preload hết mọi ns
    partialBundledLanguages: true,
    load: "currentOnly",

    lng: (() => {
      try {
        return localStorage.getItem("language") || undefined;
      } catch {
        return undefined;
      }
    })(),

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "language",
      caches: ["localStorage"],
    },
    react: {
      useSuspense: false,
    },
  });

// Prefetch ns camera sau first paint (không chặn boot)
if (typeof window !== "undefined") {
  const prefetch = () => {
    const lng = i18n.language || "vi";
    ["main", "auth", "features"].forEach((ns) => {
      i18n.loadNamespaces(ns).catch(() => {});
      // warm chunk JSON
      import(`@/locales/${lng}/${ns}.json`).catch(() => {});
    });
  };
  const ric = window.requestIdleCallback || ((cb) => setTimeout(cb, 800));
  if (document.readyState === "complete") ric(prefetch, { timeout: 2000 });
  else window.addEventListener("load", () => ric(prefetch, { timeout: 2000 }));
}

export default i18n;
