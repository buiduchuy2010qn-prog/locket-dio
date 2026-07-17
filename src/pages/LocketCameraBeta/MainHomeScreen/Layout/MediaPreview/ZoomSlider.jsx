import React, {
  useMemo,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  zoomToSliderT,
  sliderTToZoom,
  updateZoomBadge,
} from "@/utils";

const DRAG_THRESHOLD_PX = 5;
const HIDE_DELAY_MS = 2200;

/**
 * Locket-style zoom control — press-and-drag in one touch.
 *
 * - Gesture surface always mounted (never unmount mid-pointer).
 * - Visual rail hidden via opacity only when collapsed.
 * - Pointerdown starts drag immediately (refs, not React state).
 * - Compact badge (e.g. 1x) opens rail and continues same gesture as drag.
 * - Mid-drag: DOM paint only; parent gets zoom via onInputValue.
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
  const gestureRef = useRef(null);
  const trackRef = useRef(null);
  const fillRef = useRef(null);
  const thumbRailRef = useRef(null);
  const thumbBadgeRef = useRef(null);
  const compactBadgeRef = useRef(null);

  /** Gesture truth — never use React state for move gating */
  const draggingRef = useRef(false);
  const activePointerIdRef = useRef(null);
  const downPosRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const suppressClickRef = useRef(false);

  const localZoomRef = useRef(Number(value) || 1);
  const rectCacheRef = useRef(null);
  const loRef = useRef(Number(min));
  const hiRef = useRef(Number(max));
  const onInputRef = useRef(onInputValue);
  const onEndRef = useRef(onGestureEnd);
  const rafRef = useRef(0);
  const pendingXRef = useRef(null);
  const lastPaintTRef = useRef(-1);
  const hideTimerRef = useRef(0);
  /** Keep expanded while pointer is down even before setState flushes */
  const expandedRef = useRef(false);
  /** Was rail already open before this pointerdown? (seek vs badge-open) */
  const wasExpandedOnDownRef = useRef(false);
  /** After threshold, map clientX → zoom continuously */
  const trackingZoomRef = useRef(false);

  /** Visual only — show/hide rail decoration */
  const [railVisible, setRailVisible] = useState(false);

  onInputRef.current = onInputValue;
  onEndRef.current = onGestureEnd;

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

  const paint = useCallback((t, zoom) => {
    const clamped = Math.min(1, Math.max(0, t));
    const badge = updateZoomBadge(zoom);
    if (Math.abs(clamped - lastPaintTRef.current) < 0.0005) {
      if (thumbBadgeRef.current) thumbBadgeRef.current.textContent = badge;
      if (compactBadgeRef.current) compactBadgeRef.current.textContent = badge;
      return;
    }
    lastPaintTRef.current = clamped;
    if (fillRef.current) {
      fillRef.current.style.transform = `scaleX(${clamped})`;
    }
    if (thumbRailRef.current) {
      thumbRailRef.current.style.transform = `translate3d(${clamped * 100}%, 0, 0)`;
    }
    if (thumbBadgeRef.current) thumbBadgeRef.current.textContent = badge;
    if (compactBadgeRef.current) compactBadgeRef.current.textContent = badge;
  }, []);

  const clearZoomHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = 0;
    }
  }, []);

  const scheduleZoomHide = useCallback(() => {
    clearZoomHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = 0;
      if (draggingRef.current) return;
      expandedRef.current = false;
      setRailVisible(false);
    }, HIDE_DELAY_MS);
  }, [clearZoomHideTimer]);

  const showRail = useCallback(() => {
    clearZoomHideTimer();
    expandedRef.current = true;
    setRailVisible(true);
  }, [clearZoomHideTimer]);

  useEffect(() => {
    if (draggingRef.current || !ok) return;
    localZoomRef.current = safeZoom;
    paint(zoomToSliderT(safeZoom, lo, hi), safeZoom);
  }, [safeZoom, lo, hi, ok, paint]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

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

  const markerItemsRef = useRef(markerItems);
  markerItemsRef.current = markerItems;

  const getTrackRect = useCallback(() => {
    let rect = rectCacheRef.current;
    if (!rect) {
      const el = trackRef.current;
      if (!el) return null;
      rect = el.getBoundingClientRect();
      rectCacheRef.current = rect;
    }
    if (rect.width < 1) return null;
    return rect;
  }, []);

  const flushPendingX = useCallback(() => {
    rafRef.current = 0;
    const clientX = pendingXRef.current;
    pendingXRef.current = null;
    if (clientX == null) return;
    const rect = getTrackRect();
    if (!rect) return;
    const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const zoom = sliderTToZoom(p, loRef.current, hiRef.current);
    localZoomRef.current = zoom;
    paint(p, zoom);
    onInputRef.current?.(zoom);
  }, [getTrackRect, paint]);

  const updateZoomFromClientX = useCallback(
    (clientX) => {
      pendingXRef.current = clientX;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(flushPendingX);
    },
    [flushPendingX],
  );

  const snapToNearbyLensMarker = useCallback(
    (clientX) => {
      const rect = getTrackRect();
      if (!rect || rect.width < 1) return null;
      const p = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const items = markerItemsRef.current;
      if (!items?.length) return null;
      let best = null;
      let bestDist = Infinity;
      for (const m of items) {
        const d = Math.abs(m.pos - p);
        // ~28px hit at typical 280px rail ≈ 0.1 in t-space; use absolute px
        const px = d * rect.width;
        if (px < bestDist) {
          bestDist = px;
          best = m;
        }
      }
      if (!best || bestDist > 22) return null;
      const z = Math.min(hiRef.current, Math.max(loRef.current, best.zoom));
      localZoomRef.current = z;
      paint(zoomToSliderT(z, loRef.current, hiRef.current), z);
      onInputRef.current?.(z);
      return z;
    },
    [getTrackRect, paint],
  );

  const handleZoomPointerDown = useCallback(
    (event) => {
      if (disabled || !ok) return;
      // Only primary button / touch / pen
      if (event.button != null && event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      // Start gesture immediately — before any React paint of the rail
      draggingRef.current = true;
      activePointerIdRef.current = event.pointerId;
      downPosRef.current = { x: event.clientX, y: event.clientY };
      didDragRef.current = false;
      suppressClickRef.current = false;
      wasExpandedOnDownRef.current = expandedRef.current;
      // Expanded rail: seek from first pixel. Collapsed badge: wait for drag.
      trackingZoomRef.current = expandedRef.current;
      lastPaintTRef.current = -1;
      rectCacheRef.current = null;

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }

      showRail();

      // Track is always mounted (opacity only) — measure now, not after re-render
      rectCacheRef.current = trackRef.current?.getBoundingClientRect() ?? null;

      // Press on already-visible rail → jump thumb under finger immediately
      if (wasExpandedOnDownRef.current) {
        updateZoomFromClientX(event.clientX);
      }
    },
    [disabled, ok, showRail, updateZoomFromClientX],
  );

  const handleZoomPointerMove = useCallback(
    (event) => {
      if (!draggingRef.current) return;
      if (event.pointerId !== activePointerIdRef.current) return;

      event.preventDefault();

      const dx = event.clientX - downPosRef.current.x;
      const dy = event.clientY - downPosRef.current.y;
      if (
        !didDragRef.current &&
        Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX
      ) {
        didDragRef.current = true;
        suppressClickRef.current = true;
        // Same gesture from collapsed badge: start mapping zoom now
        trackingZoomRef.current = true;
      }

      if (!trackingZoomRef.current) return;
      updateZoomFromClientX(event.clientX);
    },
    [updateZoomFromClientX],
  );

  const handleZoomPointerEnd = useCallback(
    (event) => {
      if (event.pointerId !== activePointerIdRef.current) return;

      const clientX = event.clientX;
      const wasDrag = didDragRef.current;

      draggingRef.current = false;
      activePointerIdRef.current = null;
      trackingZoomRef.current = false;
      rectCacheRef.current = null;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (pendingXRef.current != null) flushPendingX();

      try {
        if (
          event.currentTarget?.hasPointerCapture?.(event.pointerId)
        ) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* ignore */
      }

      // Tap (no drag)
      if (!wasDrag) {
        if (wasExpandedOnDownRef.current) {
          // Already sought on pointerdown (or near a marker) — always end gesture
          // so parent can snap lens / clear zoomGestureActiveRef.
          const snapped = snapToNearbyLensMarker(clientX);
          onEndRef.current?.(snapped ?? localZoomRef.current);
          scheduleZoomHide();
          return;
        }
        // Collapsed badge tap: open rail only — no zoom change, no onEnd
        scheduleZoomHide();
        return;
      }

      onEndRef.current?.(localZoomRef.current);
      scheduleZoomHide();
    },
    [flushPendingX, scheduleZoomHide, snapToNearbyLensMarker],
  );

  const handleLostPointerCapture = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    activePointerIdRef.current = null;
    trackingZoomRef.current = false;
    rectCacheRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (pendingXRef.current != null) flushPendingX();
    onEndRef.current?.(localZoomRef.current);
    scheduleZoomHide();
  }, [flushPendingX, scheduleZoomHide]);

  if (!ok) return null;

  const t0 = zoomToSliderT(safeZoom, lo, hi);
  const badgeText = updateZoomBadge(safeZoom);
  const railOpen = railVisible || draggingRef.current;

  return (
    <div
      className="absolute inset-x-4 sm:inset-x-6 bottom-4 z-40 pointer-events-none flex justify-center"
      data-zoom-slider="true"
      data-locket-zoom-ui="true"
      data-no-focus
    >
      {/*
        Gesture surface ALWAYS mounted.
        Do not remount this node while a pointer is down.
      */}
      <div
        ref={gestureRef}
        className={`zoomGestureSurface pointer-events-auto w-full max-w-[280px] select-none ${
          disabled ? "opacity-45" : "opacity-100"
        }`}
        style={{
          touchAction: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
        onPointerDown={handleZoomPointerDown}
        onPointerMove={handleZoomPointerMove}
        onPointerUp={handleZoomPointerEnd}
        onPointerCancel={handleZoomPointerEnd}
        onLostPointerCapture={handleLostPointerCapture}
        onClick={(e) => {
          // Swallow synthetic click after a drag so nothing else re-triggers
          if (suppressClickRef.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClickRef.current = false;
          }
        }}
      >
        {/*
          Fixed hit box — always same size so pointer capture target never
          jumps. Compact badge and full rail share this surface; only opacity
          toggles (no unmount while pointer is down).
        */}
        <div className="relative w-full" style={{ height: 48 }}>
          {/* Compact badge (e.g. 1x) — press here to open + drag same gesture */}
          <div
            className="zoomVisual absolute inset-0 flex items-center justify-center transition-opacity duration-150"
            style={{
              opacity: railOpen ? 0 : 1,
              pointerEvents: "none",
            }}
            aria-hidden={railOpen}
          >
            <div
              className="min-w-[2.75rem] h-9 px-3 rounded-full flex items-center justify-center
                text-[13px] font-semibold tracking-wide text-white
                bg-black/55 backdrop-blur-md border border-white/25 shadow-md"
            >
              <span ref={compactBadgeRef}>{badgeText}</span>
            </div>
          </div>

          {/* Full rail — always laid out for getBoundingClientRect */}
          <div
            className="zoomVisual zoomRail absolute inset-0 transition-opacity duration-150"
            style={{
              opacity: railOpen ? 1 : 0,
              pointerEvents: "none",
            }}
            aria-hidden={!railOpen}
          >
            <div
              ref={trackRef}
              role="slider"
              aria-label="Zoom"
              aria-valuemin={lo}
              aria-valuemax={hi}
              aria-valuenow={safeZoom}
              tabIndex={-1}
              className="relative w-full h-full flex items-center"
              style={{
                touchAction: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
            >
              <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/35 pointer-events-none" />
              <div
                ref={fillRef}
                className="absolute left-0 h-[3px] w-full rounded-full bg-white/90 pointer-events-none origin-left will-change-transform"
                style={{ transform: `scaleX(${t0})` }}
              />

              {markerItems.map((m) => (
                <div
                  key={`${m.type}-${m.zoom}`}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] flex flex-col items-center justify-center pointer-events-none"
                  style={{
                    left: `${m.pos * 100}%`,
                    width: 28,
                    height: 44,
                  }}
                  aria-hidden
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
                </div>
              ))}

              <div
                ref={thumbRailRef}
                className="absolute left-0 top-1/2 z-[3] w-full pointer-events-none will-change-transform"
                style={{
                  height: 0,
                  transform: `translate3d(${t0 * 100}%, 0, 0)`,
                }}
              >
                <div className="absolute left-0 top-0 flex flex-col items-center -translate-x-1/2 -translate-y-1/2">
                  <div
                    className={`rounded-full bg-white shadow-lg border border-black/15 ${
                      disabled ? "opacity-50" : ""
                    }`}
                    style={{ width: 26, height: 26 }}
                  />
                  <div
                    ref={thumbBadgeRef}
                    className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap
                      text-[11px] font-semibold text-white px-1.5 py-0.5 rounded-md
                      bg-black/70"
                  >
                    {badgeText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
