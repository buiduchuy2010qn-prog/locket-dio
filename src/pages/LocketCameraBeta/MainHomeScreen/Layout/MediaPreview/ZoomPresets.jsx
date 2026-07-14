import React from "react";
import { ZOOM_PRESETS, formatZoomModeLabel } from "@/utils";

/**
 * Hàng nút zoom ấn (không kéo).
 * - Cam sau: 0.5/0.6 · 1x · 2x (khi máy hỗ trợ)
 * - Cam trước: 1x · 2x
 */
const ZoomPresets = ({
  activeMode = "1x",
  currentZoom = 1,
  available = { "0.5x": false, "1x": true, "2x": false, ultraFactor: null },
  facing = "environment",
  disabled = false,
  onSelect,
  visible = true,
}) => {
  if (!visible) return null;

  const isFront = facing === "user";
  const ultraFactor = available?.ultraFactor ?? null;

  const isActive = (mode) => {
    if (activeMode === mode) return true;
    if (activeMode === "custom") {
      const uf = Number(ultraFactor);
      const wideThreshold =
        Number.isFinite(uf) && uf > 0.2 && uf < 0.95
          ? (uf + 1) / 2
          : 0.75;
      if (!isFront && mode === "0.5x" && currentZoom < wideThreshold)
        return true;
      if (mode === "1x" && currentZoom >= wideThreshold && currentZoom < 1.5)
        return true;
      if (mode === "2x" && currentZoom >= 1.5) return true;
      // front: không ultra
      if (isFront && mode === "1x" && currentZoom < 1.4) return true;
    }
    return false;
  };

  // Cam trước: chỉ 1x + 2x
  const modes = isFront ? ["1x", "2x"] : ZOOM_PRESETS;

  return (
    <div
      className="absolute inset-x-0 bottom-5 z-30 pointer-events-none flex justify-center"
      data-zoom-presets="true"
      data-locket-zoom-ui="true"
    >
      <div className="pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 border border-white/10">
        {modes.map((mode) => {
          const active = isActive(mode);
          let enabled = mode === "1x" || Boolean(available?.[mode]);
          // Cam trước: luôn cho ấn 2x (digital zoom nếu HW cho phép)
          if (isFront && mode === "2x") enabled = true;
          if (mode === "0.5x" && !enabled) return null;
          if (!isFront && mode === "2x" && !enabled) return null;

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
                      ? "bg-white/15 text-white active:scale-95"
                      : "bg-white/5 text-white/30 cursor-not-allowed"
                }`}
              aria-label={`Zoom ${formatZoomModeLabel(mode, ultraFactor)}`}
              aria-pressed={active}
            >
              {formatZoomModeLabel(mode, isFront ? null : ultraFactor)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ZoomPresets;
