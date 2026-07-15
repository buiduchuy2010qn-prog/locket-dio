import React from "react";
import { Heart } from "lucide-react";
import { useUserSetting } from "@/stores";
import { useTranslation } from "react-i18next";

/**
 * Mục menu riêng "Watermark" — on/off khi lưu ảnh.
 * Hiển thị trên màn profile (vuốt trái).
 */
export default function WatermarkMenuItem() {
  const { t } = useTranslation("features");
  const saveWatermark = useUserSetting((s) => s.saveWatermark !== false);
  const toggleSaveWatermark = useUserSetting((s) => s.toggleSaveWatermark);

  return (
    <div className="px-4 pb-3">
      <div className="bg-base-200 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-primary/15 text-primary flex-shrink-0">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-base leading-tight">
                {t("setting_poup.media.menu_name", { defaultValue: "Watermark" })}
              </p>
              <p className="text-xs text-base-content/60 mt-0.5 leading-snug">
                {saveWatermark
                  ? t("setting_poup.media.watermark.on_hint", {
                      defaultValue: "Đang bật · ♥ Locket khi lưu ảnh",
                    })
                  : t("setting_poup.media.watermark.off_hint", {
                      defaultValue: "Đang tắt · lưu ảnh gốc",
                    })}
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary flex-shrink-0"
            checked={saveWatermark}
            onChange={toggleSaveWatermark}
            aria-label="Watermark"
          />
        </div>
      </div>
    </div>
  );
}
