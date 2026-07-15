import { create } from "zustand";
import i18n from "@/i18n";

const SUPPORTED = new Set(["vi", "en", "ja", "ko", "zh", "de"]);

function normalizeLang(lang) {
  const code = String(lang || "vi").split("-")[0].toLowerCase();
  return SUPPORTED.has(code) ? code : "vi";
}

export const useLanguageStore = create((set) => ({
  language: normalizeLang(
    localStorage.getItem("language") ?? i18n.language ?? "vi",
  ),

  changeLanguage: async (lang) => {
    const code = normalizeLang(lang);
    try {
      localStorage.setItem("language", code);
    } catch {
      /* ignore */
    }
    // Force load all namespaces so UI is fully in the selected language
    await i18n.changeLanguage(code);
    try {
      await i18n.loadNamespaces(["public", "main", "features", "auth"]);
    } catch {
      /* ignore */
    }
    set({ language: code });
  },
}));

// const language = useLanguageStore((state) => state.language);
// const changeLanguage = useLanguageStore((state) => state.changeLanguage);
