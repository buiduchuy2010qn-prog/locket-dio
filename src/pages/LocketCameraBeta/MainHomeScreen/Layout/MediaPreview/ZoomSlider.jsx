import React, { useMemo, useRef, useCallback, useState } from "react";
import {
  zoomToSliderT,
  sliderTToZoom,
  updateZoomBadge,
} from "@/utils";

/**
 * Native-style single zoom rail:
 * - Logarithmic t∈[0,1] ↔ global zoom
 * - Lens markers on the rail (not a separate pill row)
 * - Instant thumb (controlled value = displayZoom)
 * - Large hit target (~44px) with thin visual rail
 */
export default function ZoomSlider({
  min = 1,
  max = 1,
  value = 1,
  markers = [],
  disabled = false,
  visible = true,
  onInputValue,
  onGestureEnd,
}) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const lo = Number(min);
  const hi = Number(max);
  const ok =
    visible &&
    Number.isFinite(lo) &&
    Number.isFinite(hi) &&
    hi > lo + 0.01;

  const safeZoom = useMemo(() => {
    const v = Number(value);
    if (!Number.isFinite(v)) return lo;
    return Math.min(hi, Math.max(lo, v));
  }, [value, lo, hi]);

  const t = ok ? zoomToSliderT(safeZoom, lo, hi) : 0;

  const markerItems = useMemo(() => {
    if (!ok || !Array.isArray(markers)) return [];
    return markers
      .map((m) => {
        const z = Number(m.zoom);
        if (!Number.isFinite(z) || z < lo - 0.02 || z > hi + 0.02) return null;
        const pos = zoomToSliderT(Math.min(hi, Math.max(lo, z)), lo, hi);
        return {
          ...m,
          zoom: z,
          pos,
          label: m.label || updateZoomBadge(z).replace(/x$/i, ""),
        };
      })
      .filter(Boolean);
  }, [markers, lo, hi, ok]);

  const emitFromT = useCallback(
    (rawT) => {
      const zoom = sliderTToZoom(rawT, lo, hi);
      onInputValue?.(zoom);
    },
    [lo, hi, onInputValue],
  );

  const emitFromClientX = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1) return;
      const p = (clientX - rect.left) / rect.width;
      emitFromT(Math.min(1, Math.max(0, p)));
    },
    [emitFromT],
  );

  if (!ok) return null;

  return (
    <div
      className="absolute inset-x-6 bottom-5 z-30 pointer-events-none flex justify-center"
      data-zoom-slider="true"
      data-locket-zoom-ui="true"
      data-no-focus
    >
      <div className="pointer-events-auto w-full max-w-[260px] select-none">
        {/* 44px touch target; thin visual rail */}
        <div
          ref={trackRef}
          role="slider"
          aria-label="Zoom"
          aria-valuemin={lo}
          aria-valuemax={hi}
          aria-valuenow={safeZoom}
          tabIndex={disabled ? -1 : 0}
          className="relative w-full h-11 flex items-center touch-none cursor-pointer"
          onPointerDown={(e) => {
            if (disabled) return;
            // Ignore marker buttons (they stopPropagation)
            setDragging(true);
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            emitFromClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (!dragging || disabled) return;
            emitFromClientX(e.clientX);
          }}
          onPointerUp={(e) => {
            setDragging(false);
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            onGestureEnd?.();
          }}
          onPointerCancel={() => {
            setDragging(false);
            onGestureEnd?.();
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            const step = (hi - lo) * 0.04;
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onInputValue?.(Math.min(hi, safeZoom + step));
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onInputValue?.(Math.max(lo, safeZoom - step));
            }
          }}
        >
          {/* Rail */}
          <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/35 pointer-events-none" />
          {/* Filled portion */}
          <div
            className="absolute left-0 h-[3px] rounded-full bg-white/85 pointer-events-none"
            style={{ width: `${t * 100}%` }}
          />

          {/* Lens markers on rail */}
          {markerItems.map((m) => (
            <button
              key={`${m.type}-${m.zoom}`}
              type="button"
              disabled={disabled}
              aria-label={`Zoom ${m.label}x`}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] flex flex-col items-center gap-0.5 p-1"
              style={{ left: `${m.pos * 100}%` }}
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) return;
                onInputValue?.(Math.min(hi, Math.max(lo, m.zoom)));
                onGestureEnd?.();
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span
                className={`block rounded-full ${
                  m.emphasis || m.type === "main"
                    ? "w-2 h-2 bg-white shadow"
                    : "w-1.5 h-1.5 bg-white/80"
                }`}
              />
              <span
                className={`text-[9px] leading-none font-semibold ${
                  m.emphasis || m.type === "main"
                    ? "text-white"
                    : "text-white/75"
                }`}
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.45)" }}
              >
                {m.label}
              </span>
            </button>
          ))}

          {/* Thumb + live global zoom label */}
          <div
            className="absolute top-1/2 z-[3] -translate-y-1/2 -translate-x-1/2 pointer-events-none"
            style={{ left: `${t * 100}%` }}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-md border border-black/10 ${
                disabled ? "opacity-50" : ""
              }`}
            />
            <div
              className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap
                text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-md
                bg-black/45 backdrop-blur-sm"
            >
              {updateZoomBadge(safeZoom)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
