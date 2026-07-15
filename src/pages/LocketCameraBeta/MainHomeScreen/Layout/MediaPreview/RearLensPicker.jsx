import React from "react";

/**
 * Manual rear-camera picker — shown when classification confidence is low.
 * Exposes every rear device so the user can select the correct lens.
 * No model-specific labels: Cam 1 / Cam 2 / short label snippet.
 */
export default function RearLensPicker({
  rearOptions = [],
  activeDeviceId = null,
  visible = false,
  disabled = false,
  onSelect,
}) {
  if (!visible || !Array.isArray(rearOptions) || rearOptions.length < 2) {
    return null;
  }

  const shortLabel = (device, index) => {
    const raw = String(device?.label || "").trim();
    if (!raw) return `Cam ${index + 1}`;
    // Keep last meaningful token (avoid huge Android strings)
    const cleaned = raw
      .replace(/camera2\s*/gi, "C")
      .replace(/\s+/g, " ")
      .slice(0, 18);
    return cleaned || `Cam ${index + 1}`;
  };

  return (
    <div
      className="absolute inset-x-0 bottom-14 z-30 pointer-events-none flex justify-center"
      data-rear-lens-picker="true"
      data-locket-zoom-ui="true"
    >
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 max-w-[92%] px-2 py-1 rounded-full bg-black/45 border border-white/15">
        <span className="text-[10px] text-white/70 px-1 select-none">Lens</span>
        {rearOptions.map((device, index) => {
          const id = device?.deviceId;
          if (!id) return null;
          const active = activeDeviceId === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect?.(id, device)}
              className={`max-w-[7rem] truncate h-7 px-2.5 rounded-full text-[11px] font-semibold transition-all
                ${
                  active
                    ? "bg-white text-black scale-105"
                    : "bg-white/15 text-white active:scale-95"
                }
                ${disabled ? "opacity-40 cursor-not-allowed" : ""}
              `}
              title={device.label || id}
              aria-label={`Camera ${index + 1}: ${device.label || id}`}
              aria-pressed={active}
            >
              {shortLabel(device, index)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
