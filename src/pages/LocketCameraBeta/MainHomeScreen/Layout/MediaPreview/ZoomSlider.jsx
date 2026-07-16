import React, { useRef } from "react";

/**
 * Continuous hardware zoom slider.
 * - Thumb follows finger immediately (controlled `value` = displayZoom).
 * - Uses onInput (+ onChange for Safari) so updates fire while dragging.
 * - Parent must update displayZoom synchronously; camera apply is separate.
 */
export default function ZoomSlider({
  min = 1,
  max = 1,
  value = 1,
  disabled = false,
  visible = true,
  onInputValue,
  onGestureEnd,
}) {
  const draggingRef = useRef(false);

  if (!visible) return null;
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo + 0.01) {
    return null;
  }

  const v = Number(value);
  const safe = Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, v))
    : lo;

  const emit = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(hi, Math.max(lo, n));
    onInputValue?.(clamped);
  };

  return (
    <div
      className="absolute inset-x-8 bottom-[3.35rem] z-30 pointer-events-none flex justify-center"
      data-zoom-slider="true"
      data-locket-zoom-ui="true"
      data-no-focus
    >
      <div className="pointer-events-auto w-full max-w-[220px] px-1">
        <input
          type="range"
          min={lo}
          max={hi}
          step="any"
          value={safe}
          disabled={disabled}
          aria-label="Zoom"
          className="w-full h-1.5 accent-white cursor-pointer disabled:opacity-40"
          onPointerDown={() => {
            draggingRef.current = true;
          }}
          onPointerUp={() => {
            draggingRef.current = false;
            onGestureEnd?.();
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
            onGestureEnd?.();
          }}
          // Primary: fire continuously while dragging
          onInput={(e) => emit(e.currentTarget.value)}
          // Safari / older: also wire change
          onChange={(e) => emit(e.currentTarget.value)}
        />
      </div>
    </div>
  );
}
