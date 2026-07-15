import { SonnerInfo } from "@/components/uikit/SonnerToast";
import { Wrench } from "lucide-react";
import SwManager from "./SwAndCacheManager";
import PermissionsManager from "./PermissionsManager";
import { useTranslation } from "react-i18next";

export default function SettingsExtras() {
  const { t } = useTranslation("auth");

  return (
    <div>
      <div className="flex items-center mb-4 text-base-content">
        <Wrench className="w-5 h-5 mr-2" />
        <h2 className="text-lg font-semibold">{t("settings.extras.title")}</h2>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        {/* Cập nhật & SW */}
        <SwManager />

        <PermissionsManager />

        {/* API */}
        <div className="flex-1 bg-base-100 rounded-lg p-4 shadow-sm flex flex-col items-center gap-4">
          <h3 className="font-semibold text-lg mb-1 w-full text-center">
            {t("settings.extras.cache_api_title")}
          </h3>
          <div className="flex flex-row gap-3 items-center w-full max-w-xs">
            <input
              type="text"
              placeholder={t("settings.extras.api_placeholder")}
              className="input input-bordered flex-grow max-w-full"
            />
            <button
              onClick={() => SonnerInfo(t("settings.extras.save_config_demo"))}
              className="btn btn-secondary whitespace-nowrap"
              type="button"
              disabled
            >
              {t("settings.extras.save_config")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
