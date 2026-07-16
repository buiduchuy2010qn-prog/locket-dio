import React, { useMemo, useRef, useCallback, useEffect } from "react";
import {
  zoomToSliderT,
  sliderTToZoom,
  updateZoomBadge,
} from "@/utils";

/**
 * High-performance zoom rail.
 * During drag: paint thumb/fill/badge via DOM (no React re-render).
 * Parent only receives zoom values for camera apply (latest-wins).
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
  const fillRef = useRef(null);
  const thumbRef = useRef(null);
  const badgeRef = useRef(null);
  const draggingRef = useRef(false);
  const localZoomRef = useRef(Number(value) || 1);
  const rectCacheRef = useRef(null);
  const loRef = useRef(Number(min));
  const hiRef = useRef(Number(max));

  const lo = Number(min);
  const hi = Number(max);
  loRef.current = lo;
  hiRef.current = hi;

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

  // Sync controlled value → DOM when not dragging
  useEffect(() => {
    if (draggingRef.current || !ok) return;
    localZoomRef.current = safeZoom;
    const t = zoomToSliderT(safeZoom, lo, hi);
    paint(t, safeZoom);
  }, [safeZoom, lo, hi, ok]);

  const paint = (t, zoom) => {
    const pct = `${Math.min(100, Math.max(0, t * 100))}%`;
    if (fillRef.current) fillRef.current.style.width = pct;
    if (thumbRef.current) thumbRef.current.style.left = pct;
    if (badgeRef.current) badgeRef.current.textContent = updateZoomBadge(zoom);
  };

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
      // Cache rect during drag — avoid layout thrash every move
      let rect = rectCacheRef.current;
      if (!rect) {
        rect = el.getBoundingClientRect();
        rectCacheRef.current = rect;
      }
      if (rect.width < 1) return;
      const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const zoom = sliderTToZoom(p, loRef.current, hiRef.current);
      localZoomRef.current = zoom;
      // Instant paint — no setState
      paint(p, zoom);
      onInputValue?.(zoom);
    },
    [onInputValue],
  );

  const endDrag = useCallback(
    (e) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      rectCacheRef.current = null;
      try {
        if (e?.currentTarget && e.pointerId != null) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      onGestureEnd?.(localZoomRef.current);
    },
    [onGestureEnd],
  );

  if (!ok) return null;

  const t0 = zoomToSliderT(safeZoom, lo, hi);

  return (
    <div
      className="absolute inset-x-4 sm:inset-x-6 bottom-4 z-40 pointer-events-none flex justify-center"
      data-zoom-slider="true"
      data-locket-zoom-ui="true"
      data-no-focus
    >
      <div
        className={`pointer-events-auto w-full max-w-[280px] select-none ${
          disabled ? "opacity-45" : "opacity-100"
        }`}
        style={{ touchAction: "none" }}
      >
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
            rectCacheRef.current = e.currentTarget.getBoundingClientRect();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
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
              rectCacheRef.current = null;
              onGestureEnd?.(localZoomRef.current);
            }
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            const step = (hi - lo) * 0.03;
            let z = localZoomRef.current;
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              z = Math.min(hi, z + step);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              z = Math.max(lo, z - step);
            } else return;
            localZoomRef.current = z;
            paint(zoomToSliderT(z, lo, hi), z);
            onInputValue?.(z);
          }}
        >
          <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/35 pointer-events-none" />
          <div
            ref={fillRef}
            className="absolute left-0 h-[3px] rounded-full bg-white/90 pointer-events-none will-change-[width]"
            style={{ width: `${t0 * 100}%` }}
          />

          {markerItems.map((m) => (
            <button
              key={`${m.type}-${m.zoom}`}
              type="button"
              disabled={disabled}
              aria-label={`Zoom ${m.label}x`}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] flex flex-col items-center justify-center pointer-events-auto"
              style={{
                left: `${m.pos * 100}%`,
                width: 28,
                height: 44,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) return;
                const z = Math.min(hi, Math.max(lo, m.zoom));
                localZoomRef.current = z;
                paint(zoomToSliderT(z, lo, hi), z);
                onInputValue?.(z);
                onGestureEnd?.(z);
              }}
              onPointerDown={(e) => e.stopPropagation()}
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

          <div
            ref={thumbRef}
            className="absolute top-1/2 z-[3] -translate-y-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center will-change-[left]"
            style={{ left: `${t0 * 100}%` }}
          >
            <div
              className={`rounded-full bg-white shadow-lg border border-black/15 ${
                disabled ? "opacity-50" : ""
              }`}
              style={{ width: 26, height: 26 }}
            />
            <div
              ref={badgeRef}
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
