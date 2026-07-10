import { Globe, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function LanguageSetting({ currentLang, setLangOpen }) {
  const { t } = useTranslation("auth");

  return (
    <div className="w-full">
      <div className="flex items-center mb-4 text-base-content">
        <Globe className="w-5 h-5 mr-2" />
        <h2 className="text-lg font-semibold">
          {t("settings.language.title")}
        </h2>
      </div>

      <p className="text-sm text-base-content/60 mb-4">
        {t("settings.language.description")}
      </p>

      <button
        onClick={setLangOpen}
        className="w-full flex items-center justify-between px-4 py-3 bg-base-100 rounded-xl hover:bg-base-200 active:scale-[0.98] transition-all duration-150 group"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{currentLang.flag}</span>
          <div className="text-left">
            <p className="text-xs text-base-content/50 mb-0.5">
              {t("settings.language.current_label")}
            </p>
            <p className="font-semibold text-base-content">
              {currentLang.name}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-base-content/40 group-hover:text-base-content/70 group-hover:translate-x-0.5 transition-all" />
      </button>
    </div>
  );
}
