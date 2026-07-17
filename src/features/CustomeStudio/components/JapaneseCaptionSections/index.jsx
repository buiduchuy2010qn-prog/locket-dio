import React, { useMemo } from "react";
import { getCaptionStyle } from "@/helpers/styleHelpers";
import IconRenderer from "@/components/Overlay/icons/IconRenderer";
import { hasValidIcon } from "../../utils/overlayLabels";
import {
  buildJapaneseCaptionSections,
  toJapanesePayloadCaption,
} from "../../data/japaneseCaptionPresets";

/**
 * 🇯🇵 Caption Nhật Bản — same capsule chrome as Decorative by Locket.
 * Shows JA (main) + VI (picker only). onSelect receives Locket-safe payload.
 */
const JapaneseCaptionSections = ({ onSelect }) => {
  const sections = useMemo(() => buildJapaneseCaptionSections(), []);

  if (!sections.length) return null;

  return (
    <>
      {sections.map((section) => (
        <div key={section.section_id} className="px-4 pb-2">
          <div className="flex flex-row gap-3 items-center mb-3">
            <h2 className="text-md font-semibold text-primary">
              {section.name}
            </h2>
            {section?.badge && (
              <div className="badge badge-sm badge-secondary">
                {section.badge}
              </div>
            )}
          </div>

          {/* Horizontal scroll row — same capsule buttons as Decorative */}
          <div className="flex flex-row flex-nowrap gap-3 justify-start overflow-x-auto no-scrollbar pb-1">
            {(section.items || []).map((item) => {
              const ja = item.text || item.caption || "";
              const vi = item.vi_label || "";
              const romaji = item.romaji_label || "";
              const showIcon = hasValidIcon(item.icon);
              const key = item.overlay_id || item.id;
              const tip = [ja, romaji, vi].filter(Boolean).join(" — ");

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect(toJapanesePayloadCaption(item))}
                  className="relative flex flex-col whitespace-pre-wrap items-center space-y-0.5 py-2 px-4 btn h-auto w-auto min-h-[2.5rem] min-w-max rounded-3xl font-semibold justify-center overflow-hidden border-0 shadow-sm shrink-0"
                  style={{
                    ...getCaptionStyle(item.background, item?.text_color),
                  }}
                  title={tip || ja}
                >
                  <span className="text-base flex items-center gap-1.5 relative z-[1]">
                    {showIcon && (
                      <span className="inline-flex items-center justify-center w-5 h-5 shrink-0 [&_img]:w-5 [&_img]:h-5 [&_img]:object-contain [&_svg]:w-5 [&_svg]:h-5">
                        <IconRenderer icon={item.icon} />
                      </span>
                    )}
                    <span className="leading-tight">{ja}</span>
                  </span>
                  {vi ? (
                    <span
                      className="text-[10px] font-medium leading-tight opacity-80 relative z-[1] max-w-[11rem] text-center"
                      style={{ color: "inherit" }}
                    >
                      {vi}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
};

export default JapaneseCaptionSections;
