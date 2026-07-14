import React, { useCallback, useMemo, useRef } from "react";
import { updateZoomBadge } from "@/utils";
import "./zoom-slider.css";

/**
 * Thanh kéo zoom — cam trước + cam sau.
 * DOM đơn giản (1 input range) để tránh crash removeChild.
 */
const ZoomPresets = ({
  currentZoom = 1,
  minZoom = 1,
  maxZoom = 1,
  available = { "0.5x": false, "1x": true, "2x": false, ultraFactor: null },
  facing = "environment",
  disabled = false,
  onChange,
  onChangeEnd,
  visible = true,
}) => {
  const dragging = useRef(false);

  const isFront = facing === "user";
  const uf = Number(available?.ultraFactor);
  const hasUltra =
    !isFront &&
    (Boolean(available?.["0.5x"]) ||
      (Number.isFinite(uf) && uf > 0.2 && uf < 0.95));
  const has2x =
    Boolean(available?.["2x"]) || Number(maxZoom) >= 1.8;

  const minZ = useMemo(() => {
    if (isFront) return Math.max(1, Number(minZoom) || 1);
    if (hasUltra && Number.isFinite(uf) && uf > 0.2 && uf < 0.95) {
      return Math.min(Number(minZoom) || uf, uf);
    }
    if (hasUltra) return Math.min(Number(minZoom) || 0.5, 0.5);
    const m = Number(minZoom);
    return Number.isFinite(m) && m > 0 ? m : 1;
  }, [isFront, hasUltra, uf, minZoom]);

  const maxZ = useMemo(() => {
    const m = Number(maxZoom);
    if (Number.isFinite(m) && m > minZ + 0.01) return m;
    if (has2x) return Math.max(2, minZ + 0.01);
    // Cam trước đôi khi max=1 → vẫn cho slider 1→2 (digital nếu HW không hỗ trợ thì clamp)
    if (isFront) return Math.max(minZ + 0.01, 2);
    return Math.max(minZ + 0.01, 1);
  }, [maxZoom, minZ, has2x, isFront]);

  const canSlide = maxZ > minZ + 0.04;

  const value = useMemo(() => {
    const z = Number(currentZoom);
    if (!Number.isFinite(z)) return Math.max(minZ, 1);
    return Math.max(minZ, Math.min(z, maxZ));
  }, [currentZoom, minZ, maxZ]);

  const emit = useCallback(
    (raw, end = false) => {
      let z = Math.max(minZ, Math.min(Number(raw) || 1, maxZ));
      z = Math.round(z * 100) / 100;
      if (end) onChangeEnd?.(z);
      else onChange?.(z);
    },
    [minZ, maxZ, onChange, onChangeEnd],
  );

  // Mốc nhãn: ultra / 1 / 2
  const marks = useMemo(() => {
    const list = [];
    if (hasUltra) {
      const f =
        Number.isFinite(uf) && uf > 0.2 && uf < 0.95
          ? Math.round(uf * 10) / 10
          : 0.5;
      list.push({ z: f, label: String(f) });
    }
    list.push({ z: 1, label: "1" });
    if (maxZ >= 1.7) list.push({ z: Math.min(2, maxZ), label: "2" });
    return list.filter((m) => m.z >= minZ - 0.05 && m.z <= maxZ + 0.05);
  }, [hasUltra, uf, minZ, maxZ]);

  if (!visible) return null;

  const labelFacing = isFront ? "Trước" : "Sau";

  return (
    <div
      className="absolute inset-x-0 bottom-4 z-30 flex justify-center px-3 pointer-events-none"
      data-zoom-presets="true"
      data-locket-zoom-ui="true"
    >
      <div
        className={`pointer-events-auto w-full max-w-[260px] rounded-2xl px-3 py-2
          bg-black/50 border border-white/15 shadow-lg
          ${disabled ? "opacity-45 pointer-events-none" : ""}`}
      >
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-[10px] font-medium text-white/55">
            Zoom · {labelFacing}
          </span>
          <span className="min-w-[2.25rem] text-center text-[11px] font-semibold text-white px-2 py-0.5 rounded-full bg-white/20">
            {updateZoomBadge(value)}
          </span>
        </div>

        {canSlide ? (
          <>
            <input
              type="range"
              min={minZ}
              max={maxZ}
              step={0.01}
              value={value}
              disabled={disabled}
              aria-label={`Zoom camera ${labelFacing}`}
              className="hl-zoom-range"
              onPointerDown={() => {
                dragging.current = true;
              }}
              onPointerUp={(e) => {
                dragging.current = false;
                emit(e.currentTarget.value, true);
              }}
              onPointerCancel={() => {
                dragging.current = false;
              }}
              onChange={(e) => emit(e.target.value, false)}
            />

            <div className="flex justify-between px-0.5 mt-0.5">
              {marks.map((m) => {
                const active = Math.abs(value - m.z) < 0.12;
                return (
                  <button
                    key={`${m.label}-${m.z}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      emit(m.z, false);
                      emit(m.z, true);
                    }}
                    className={`text-[10px] font-semibold px-1 py-0.5 rounded transition-colors
                      ${active ? "text-white" : "text-white/45 active:text-white/80"}`}
                  >
                    {m.label}x
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-white/45 text-center py-1">
            Chỉ 1x trên camera này
          </p>
        )}
      </div>
    </div>
  );
};

export default ZoomPresets;
