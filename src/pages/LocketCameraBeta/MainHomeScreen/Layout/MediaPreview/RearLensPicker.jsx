import React, { useEffect, useState } from "react";
import { isPhoneLikeCameraEnv, isVirtualOrDesktopCamera } from "@/utils";

/**
 * Manual rear-camera picker — ONLY on real phones when classification
 * confidence is low. Hidden on desktop (Integrated Webcam / OBS / …)
 * so it never blocks the zoom UI.
 */
export default function RearLensPicker({
  rearOptions = [],
  activeDeviceId = null,
  visible = false,
  disabled = false,
  onSelect,
}) {
  const [expanded, setExpanded] = useState(false);

  // First time UW discovers several rear inputs, show the choices. After the
  // user picks one, collapse to a small "Lens" button like a native camera.
  useEffect(() => {
    if (visible) setExpanded(true);
  }, [visible]);

  if (!visible) return null;
  if (!isPhoneLikeCameraEnv()) return null;

  const options = (Array.isArray(rearOptions) ? rearOptions : []).filter(
    (d) => d?.deviceId && !isVirtualOrDesktopCamera(d.label || ""),
  );

  if (options.length < 2) return null;

  const shortLabel = (device, index) => {
    const raw = String(device?.label || "").trim();
    if (!raw) return `Cam ${index + 1}`;
    // Prefer camera2 index for Samsung-style labels
    const m = raw.match(/camera2\s*(\d+)/i);
    if (m) return `C${m[1]}`;
    const cleaned = raw
      .replace(/camera2\s*/gi, "C")
      .replace(/\s+/g, " ")
      .slice(0, 12);
    return cleaned || `Cam ${index + 1}`;
  };

  return (
    <div
      className="absolute inset-x-0 top-3 z-30 pointer-events-none flex justify-center"
      data-rear-lens-picker="true"
      data-locket-zoom-ui="true"
    >
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 max-w-[94%] px-1.5 py-0.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10">
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setExpanded((value) => !value)}
          className={`h-6 px-2 rounded-full text-[10px] font-semibold transition-all
            ${expanded ? "bg-amber-400 text-black" : "bg-white/15 text-white"}
            ${disabled ? "opacity-40 cursor-not-allowed" : "active:scale-95"}
          `}
          aria-expanded={expanded}
          aria-label="Chọn ống kính camera sau"
        >
          Lens
        </button>

        {expanded &&
          options.map((device, index) => {
            const id = device?.deviceId;
            if (!id) return null;
            const active = activeDeviceId === id;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={async () => {
                  if (disabled) return;
                  const ok = await onSelect?.(id, device);
                  if (ok !== false) setExpanded(false);
                }}
                className={`max-w-[5.5rem] truncate h-6 px-2 rounded-full text-[10px] font-semibold transition-all
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
