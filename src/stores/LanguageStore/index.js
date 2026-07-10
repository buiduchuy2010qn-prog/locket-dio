import { create } from "zustand";
import i18n from "@/i18n";

export const useLanguageStore = create((set) => ({
  language: localStorage.getItem("language") ?? i18n.language ?? "vi",

  changeLanguage: (lang) => {
    i18n.changeLanguage(lang);

    set({
      language: lang,
    });
  },
}));

// const language = useLanguageStore((state) => state.language);
// const changeLanguage = useLanguageStore((state) => state.changeLanguage);
