import React from "react";
import { ZOOM_PRESETS, formatZoomModeLabel } from "@/utils";

/**
 * Compact preset pills inside camera frame (bottom). No slider.
 * Presets: 0.5 · 1x · 2x
 */
const ZoomPresets = ({
  activeMode = "1x",
  currentZoom = 1,
  available = { "0.5x": true, "1x": true, "2x": false },
  disabled = false,
  onSelect,
  visible = true,
}) => {
  if (!visible) return null;

  const isActive = (mode) => {
    if (activeMode === mode) return true;
    // When pinching custom values, highlight nearest preset
    if (activeMode === "custom") {
      if (mode === "0.5x" && currentZoom < 0.75) return true;
      if (mode === "1x" && currentZoom >= 0.75 && currentZoom < 1.5) return true;
      if (mode === "2x" && currentZoom >= 1.5) return true;
    }
    return false;
  };

  return (
    <div
      className="absolute inset-x-0 bottom-5 z-30 pointer-events-none flex justify-center"
      data-zoom-presets="true"
    >
      <div className="pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
        {ZOOM_PRESETS.map((mode) => {
          const active = isActive(mode);
          const enabled = mode === "1x" || Boolean(available?.[mode]);
          return (
            <button
              key={mode}
              type="button"
              disabled={!enabled || disabled}
              onClick={() => enabled && onSelect?.(mode)}
              className={`min-w-[2.25rem] h-8 px-2 rounded-full text-xs font-semibold transition-all
                ${
                  active
                    ? "bg-white text-black scale-105"
                    : enabled
                      ? "bg-white/15 text-white hover:bg-white/25 active:scale-95"
                      : "bg-white/5 text-white/30 cursor-not-allowed"
                }`}
              aria-label={`Zoom ${formatZoomModeLabel(mode)}`}
              aria-pressed={active}
            >
              {formatZoomModeLabel(mode)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ZoomPresets;
