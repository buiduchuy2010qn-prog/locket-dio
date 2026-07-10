import { getCaptionStyle } from "@/helpers/styleHelpers";
import React from "react";
import IconRenderer from "@/components/Overlay/icons/IconRenderer";
import {
  getOverlayDisplayText,
  hasValidIcon,
} from "../../utils/overlayLabels";

const CaptionSections = ({ sections, onSelect }) => {
  if (!sections?.length) return null;

  return (
    <>
      {sections
        .filter((section) => section.active)
        .sort((a, b) => (a.order_id ?? 0) - (b.order_id ?? 0))
        .map((section) => {
          const items = (section.items || [])
            .filter((item) => item.active !== false)
            .sort((a, b) => (a.order_id ?? 0) - (b.order_id ?? 0));

          if (!items.length) return null;

          return (
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

              <div className="flex flex-wrap gap-3 justify-start">
                {items.map((item, idx) => {
                  const label = getOverlayDisplayText(item);
                  const key =
                    item.overlay_id ||
                    item.id ||
                    `${section.section_id}-${idx}-${label}`;
                  const showIcon = hasValidIcon(item.icon);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSelect(item)}
                      className="relative flex flex-col whitespace-pre-wrap items-center space-y-1 py-2 px-4 btn h-auto w-auto min-h-[2.5rem] rounded-3xl font-semibold justify-center overflow-hidden border-0 shadow-sm"
                      style={{
                        ...getCaptionStyle(item.background, item?.text_color),
                      }}
                      title={label}
                    >
                      <span className="text-base flex items-center gap-1.5 relative z-[1]">
                        {showIcon && (
                          <span className="inline-flex items-center justify-center w-5 h-5 shrink-0 [&_img]:w-5 [&_img]:h-5 [&_img]:object-contain [&_svg]:w-5 [&_svg]:h-5">
                            <IconRenderer icon={item.icon} />
                          </span>
                        )}
                        <span className="leading-tight">{label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
    </>
  );
};

export default CaptionSections;
