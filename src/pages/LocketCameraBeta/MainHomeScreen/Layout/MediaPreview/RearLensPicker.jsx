import React, { useState } from "react";
import {
  isVirtualOrDesktopCamera,
  isConfidentUltraLabel,
  shouldOfferLensPicker,
} from "@/utils";

/**
 * Cross-platform rear lens picker (Android / iOS Safari / desktop multi-cam).
 * Visibility is feature-based (multiple rear deviceIds), not userAgent.
 *
 * Options:
 *  - Tự động
 *  - Camera sau 1..N
 *  - Siêu rộng (when relatively confident)
 */
export default function RearLensPicker({
  rearOptions = [],
  activeDeviceId = null,
  visible = false,
  disabled = false,
  ultraDeviceId = null,
  showAuto = true,
  onSelect,
  onSelectAuto,
}) {
  const [expanded, setExpanded] = useState(false);

  if (!visible) return null;

  const options = (Array.isArray(rearOptions) ? rearOptions : []).filter(
    (d) => d?.deviceId && !isVirtualOrDesktopCamera(d.label || ""),
  );

  // Need 2+ public rears unless parent forced visible with a useful list
  if (!shouldOfferLensPicker(options.length) && options.length < 1) return null;
  if (options.length < 1) return null;

  const confidentUltra =
    ultraDeviceId && options.some((d) => d.deviceId === ultraDeviceId);

  const shortLabel = (device, index) => {
    const raw = String(device?.label || "").trim();
    if (!raw) return `Camera sau ${index + 1}`;
    const m = raw.match(/camera2\s*(\d+)/i);
    if (m) return `Camera sau ${Number(m[1]) + 1}`;
    if (isConfidentUltraLabel(raw)) return "Siêu rộng";
    // Desktop webcams: keep a short real name
    if (raw.length <= 14) return raw;
    return `Camera sau ${index + 1}`;
  };

  const items = [];
  if (showAuto) {
    items.push({
      key: "auto",
      label: "Tự động",
      kind: "auto",
      deviceId: null,
    });
  }
  options.forEach((device, index) => {
    items.push({
      key: device.deviceId,
      label: shortLabel(device, index),
      kind: "device",
      deviceId: device.deviceId,
      device,
      title: device.label || device.deviceId,
    });
  });
  if (confidentUltra) {
    const already = items.some(
      (it) => it.deviceId === ultraDeviceId && it.kind === "ultra",
    );
    if (!already) {
      items.push({
        key: `ultra-${ultraDeviceId}`,
        label: "Siêu rộng",
        kind: "ultra",
        deviceId: ultraDeviceId,
      });
    }
  }

  return (
    <div
      className="absolute inset-x-0 top-3 z-30 pointer-events-none flex justify-center"
      data-rear-lens-picker="true"
      data-locket-zoom-ui="true"
      data-no-focus
    >
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 max-w-[94%] px-1.5 py-0.5 rounded-full bg-black/45 backdrop-blur-md border border-white/10">
        <button
          type="button"
          data-no-focus
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
          items.map((item) => {
            const active =
              item.kind === "auto"
                ? false
                : item.deviceId && activeDeviceId === item.deviceId;
            return (
              <button
                key={item.key}
                type="button"
                data-no-focus
                disabled={disabled}
                onClick={async () => {
                  if (disabled) return;
                  let ok = true;
                  if (item.kind === "auto") {
                    ok = await onSelectAuto?.();
                  } else {
                    ok = await onSelect?.(item.deviceId, item.device || null);
                  }
                  if (ok !== false) setExpanded(false);
                }}
                className={`max-w-[6.5rem] truncate h-6 px-2 rounded-full text-[10px] font-semibold transition-all
                  ${
                    active
                      ? "bg-white text-black scale-105"
                      : item.kind === "ultra"
                        ? "bg-emerald-500/30 text-emerald-100 active:scale-95"
                        : item.kind === "auto"
                          ? "bg-amber-400/25 text-amber-50 active:scale-95"
                          : "bg-white/15 text-white active:scale-95"
                  }
                  ${disabled ? "opacity-40 cursor-not-allowed" : ""}
                `}
                title={item.title || item.label}
                aria-label={item.label}
                aria-pressed={active}
              >
                {item.label}
              </button>
            );
          })}
      </div>
    </div>
  );
}
