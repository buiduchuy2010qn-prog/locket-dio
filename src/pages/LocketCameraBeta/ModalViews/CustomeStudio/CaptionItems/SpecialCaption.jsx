import SnowEffect from "@/components/Effects/SnowEffect";
import React from "react";

const SpecialCaption = ({
  title = "⭐ Caption đặc biệt",
  presets = [],
  onSelect,
}) => {
  const list = Array.isArray(presets) ? presets : [];
  const isLoading = list.length === 0;

  return (
    <div className="px-4">
      {title && (
        <h2 className="text-md font-semibold text-primary mb-2">{title}</h2>
      )}
      <div className="flex flex-wrap gap-3 pt-2 pb-5 justify-start">
        {isLoading ? (
          <div className="text-sm text-base-content/60 py-2">
            Đang tải caption...
          </div>
        ) : (
          list.map((preset) => {
            const top = preset.color_top || "#444";
            const bot = preset.color_bottom || "#222";
            const textColor = preset.text_color || "#FFFFFF";
            const label =
              preset.preset_caption || preset.caption || "Caption";
            const icon = preset.icon || "";

            return (
              <button
                key={preset.preset_id || preset.id || label}
                type="button"
                className="relative overflow-hidden flex flex-row whitespace-nowrap items-center gap-1.5 py-2 px-4 btn h-auto w-auto rounded-3xl font-semibold justify-center shadow-sm border-0 active:scale-95 transition"
                style={{
                  background: `linear-gradient(to bottom, ${top}, ${bot})`,
                  color: textColor,
                }}
                onClick={() =>
                  onSelect(
                    preset.preset_id || preset.id,
                    icon,
                    top,
                    bot,
                    label,
                    textColor,
                    preset.type || "special"
                  )
                }
              >
                <div className="absolute inset-0 z-0 pointer-events-none opacity-60">
                  <SnowEffect snowflakeCount={30} />
                </div>
                <span className="relative z-10 text-base">
                  {icon ? `${icon} ` : ""}
                  {label}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SpecialCaption;
