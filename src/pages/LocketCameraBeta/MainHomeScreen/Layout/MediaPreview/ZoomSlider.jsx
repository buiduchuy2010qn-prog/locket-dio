import React, { useMemo, useRef, useCallback, useState } from "react";
import {
  zoomToSliderT,
  sliderTToZoom,
  updateZoomBadge,
} from "@/utils";

/**
 * Native-style single zoom rail — finger tracking is priority:
 * - Visual rail thin; hit target ≥ 48px
 * - Thumb ~26px visual, 44×44 touch
 * - pointerdown capture + pointermove (ref, not React state) so drag never lags
 * - Logarithmic t∈[0,1] ↔ global zoom
 * - Lens markers on rail (tap snaps); continuous drag never auto-snaps
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
  /** Must be a ref — React state would lag one frame and drop first moves */
  const draggingRef = useRef(false);
  const [draggingUi, setDraggingUi] = useState(false);

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

  const emitFromClientX = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1) return;
      const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const zoom = sliderTToZoom(p, lo, hi);
      onInputValue?.(zoom);
    },
    [lo, hi, onInputValue],
  );

  const endDrag = useCallback(
    (e) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDraggingUi(false);
      try {
        if (e?.currentTarget && e.pointerId != null) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      onGestureEnd?.(safeZoom);
    },
    [onGestureEnd, safeZoom],
  );

  if (!ok) return null;

  return (
    <div
      className="absolute inset-x-4 sm:inset-x-6 bottom-4 z-40 pointer-events-none flex justify-center"
      data-zoom-slider="true"
      data-locket-zoom-ui="true"
      data-no-focus
    >
      <div
        className="pointer-events-auto w-full max-w-[280px] select-none"
        style={{ touchAction: "none" }}
      >
        {/* ≥48px touch height; thin visual rail inside */}
        <div
          ref={trackRef}
          role="slider"
          aria-label="Zoom"
          aria-valuemin={lo}
          aria-valuemax={hi}
          aria-valuenow={safeZoom}
          tabIndex={disabled ? -1 : 0}
          className="relative w-full flex items-center cursor-pointer"
          style={{
            height: 48,
            touchAction: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
          onPointerDown={(e) => {
            if (disabled) return;
            e.preventDefault();
            e.stopPropagation();
            draggingRef.current = true;
            setDraggingUi(true);
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            // Jump to tap position immediately, then track finger
            emitFromClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current || disabled) return;
            e.preventDefault();
            emitFromClientX(e.clientX);
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={() => {
            if (draggingRef.current) {
              draggingRef.current = false;
              setDraggingUi(false);
              onGestureEnd?.(safeZoom);
            }
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            const step = (hi - lo) * 0.03;
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onInputValue?.(Math.min(hi, safeZoom + step));
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onInputValue?.(Math.max(lo, safeZoom - step));
            }
          }}
        >
          {/* Rail (visual only) */}
          <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/35 pointer-events-none" />
          <div
            className="absolute left-0 h-[3px] rounded-full bg-white/90 pointer-events-none"
            style={{ width: `${t * 100}%` }}
          />

          {/* Lens markers — pointer-events none while dragging so rail keeps capture */}
          {markerItems.map((m) => (
            <button
              key={`${m.type}-${m.zoom}`}
              type="button"
              disabled={disabled || draggingUi}
              aria-label={`Zoom ${m.label}x`}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] flex flex-col items-center justify-center"
              style={{
                left: `${m.pos * 100}%`,
                width: 28,
                height: 44,
                pointerEvents: draggingUi ? "none" : "auto",
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) return;
                onInputValue?.(Math.min(hi, Math.max(lo, m.zoom)));
                onGestureEnd?.(m.zoom);
              }}
              onPointerDown={(e) => {
                // Allow tap without starting rail drag
                e.stopPropagation();
              }}
            >
              <span
                className={`block rounded-full ${
                  m.emphasis || m.type === "main"
                    ? "w-2.5 h-2.5 bg-white shadow"
                    : "w-1.5 h-1.5 bg-white/85"
                }`}
              />
              <span
                className={`mt-0.5 text-[9px] leading-none font-semibold ${
                  m.emphasis || m.type === "main"
                    ? "text-white"
                    : "text-white/80"
                }`}
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
              >
                {m.label}
              </span>
            </button>
          ))}

          {/* Thumb: 26px visual, 44×44 hit via parent track */}
          <div
            className="absolute top-1/2 z-[3] -translate-y-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center"
            style={{ left: `${t * 100}%` }}
          >
            <div
              className={`rounded-full bg-white shadow-lg border border-black/15 ${
                disabled ? "opacity-50" : ""
              } ${draggingUi ? "scale-110" : ""}`}
              style={{
                width: 26,
                height: 26,
                transition: "transform 60ms linear",
              }}
            />
            <div
              className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap
                text-[11px] font-semibold text-white px-1.5 py-0.5 rounded-md
                bg-black/50 backdrop-blur-sm"
            >
              {updateZoomBadge(safeZoom)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
