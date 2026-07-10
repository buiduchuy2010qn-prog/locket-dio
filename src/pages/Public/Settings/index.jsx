import React, { Suspense, lazy, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLanguageStore } from "@/stores";
import LanguagePopup from "@/features/LanguagePopup";
import LanguageSetting from "./LanguageSetting";
import { LANGUAGE_NAMES } from "@/constants";

// Lazy load components
const ThemeViewSelect = lazy(() => import("./ThemeViewSelect"));
const ThemeSelector = lazy(() => import("@/components/Theme/ThemeSelector"));
const SettingsExtras = lazy(() => import("./SettingExtras"));
const CameraFrameSelector = lazy(() => import("./CameraFrameSelector"));
const CameraBackground = lazy(() => import("./CameraBackground"));
const GoogleDriveBackup = lazy(() => import("./GoogleDriveBackup"));

const SuspenseCard = ({ children }) => (
  <Suspense
    fallback={
      <div className="bg-base-300 rounded-2xl shadow-md p-4 h-[200px] flex items-center justify-center">
        <span className="loading loading-spinner text-primary"></span>
      </div>
    }
  >
    <div className="bg-base-300 rounded-2xl shadow-md p-4 h-full flex flex-col">
      {children}
    </div>
  </Suspense>
);

export default function Settings() {
  const { t, i18n } = useTranslation("auth");
  const [langOpen, setLangOpen] = useState(false);
  const language = useLanguageStore((s) => s.language);

  const currentLang =
    LANGUAGE_NAMES[(i18n.resolvedLanguage || i18n.language).split("-")[0]] ??
    LANGUAGE_NAMES["vi"];

  return (
    <>
      <div className="w-full min-h-screen bg-base-200 py-6 px-4 sm:px-6 lg:px-8 flex justify-center">
        <div className="w-full max-w-7xl">
          <h1 className="text-4xl font-lovehouse font-semibold text-base-content mb-6 text-center">
            {t("settings.page_title")}
          </h1>

          {/* Responsive grid: 1 -> 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* ── Language Card ── */}
            <SuspenseCard>
              <LanguageSetting
                currentLang={currentLang}
                setLangOpen={() => setLangOpen(true)}
              />
            </SuspenseCard>

            <SuspenseCard>
              <ThemeViewSelect />
            </SuspenseCard>

            <SuspenseCard>
              <CameraBackground />
            </SuspenseCard>

            <SuspenseCard>
              <ThemeSelector />
            </SuspenseCard>

            <SuspenseCard>
              <CameraFrameSelector />
            </SuspenseCard>

            <SuspenseCard>
              <SettingsExtras />
            </SuspenseCard>

            {/* Chỉ admin thấy form kết nối Drive */}
            <SuspenseCard>
              <GoogleDriveBackup />
            </SuspenseCard>
          </div>
        </div>
      </div>

      <LanguagePopup open={langOpen} onClose={() => setLangOpen(false)} />
    </>
  );
}
