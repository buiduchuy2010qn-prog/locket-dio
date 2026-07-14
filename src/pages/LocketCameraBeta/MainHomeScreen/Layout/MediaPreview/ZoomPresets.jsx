import React, { useCallback, useMemo, useRef } from "react";
import { updateZoomBadge } from "@/utils";

/**
 * Thanh kéo zoom liên tục (kéo = zoom).
 * min…max theo hardware; nhãn mốc 0.6 / 1x / 2x khi có.
 */
const ZoomPresets = ({
  currentZoom = 1,
  minZoom = 1,
  maxZoom = 1,
  available = { "0.5x": false, "1x": true, "2x": false, ultraFactor: null },
  disabled = false,
  onChange,
  onChangeEnd,
  visible = true,
}) => {
  const dragging = useRef(false);

  const uf = Number(available?.ultraFactor);
  const hasUltra =
    Boolean(available?.["0.5x"]) ||
    (Number.isFinite(uf) && uf > 0.2 && uf < 0.95);
  const has2x = Boolean(available?.["2x"]) || maxZoom >= 1.8;

  // Phạm vi slider
  const minZ = useMemo(() => {
    if (hasUltra && Number.isFinite(uf) && uf > 0.2 && uf < 0.95) {
      return Math.min(Number(minZoom) || uf, uf);
    }
    if (hasUltra) return Math.min(Number(minZoom) || 0.5, 0.5);
    const m = Number(minZoom);
    return Number.isFinite(m) && m > 0 ? m : 1;
  }, [hasUltra, uf, minZoom]);

  const maxZ = useMemo(() => {
    const m = Number(maxZoom);
    if (Number.isFinite(m) && m > minZ) return m;
    return has2x ? Math.max(2, minZ + 0.01) : Math.max(1, minZ);
  }, [maxZoom, minZ, has2x]);

  // Không có khoảng zoom → chỉ hiện badge 1x (tránh slider vô dụng)
  const canSlide = maxZ > minZ + 0.05;

  const value = useMemo(() => {
    const z = Number(currentZoom);
    if (!Number.isFinite(z)) return 1;
    return Math.max(minZ, Math.min(z, maxZ));
  }, [currentZoom, minZ, maxZ]);

  const emit = useCallback(
    (raw, end = false) => {
      const z = Math.max(minZ, Math.min(Number(raw) || 1, maxZ));
      // Làm tròn 2 chữ số — mượt + khớp step HW
      const rounded = Math.round(z * 100) / 100;
      if (end) onChangeEnd?.(rounded);
      else onChange?.(rounded);
    },
    [minZ, maxZ, onChange, onChangeEnd],
  );

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
    if (has2x && maxZ >= 1.7) list.push({ z: 2, label: "2" });
    if (maxZ >= 3.5) list.push({ z: Math.min(5, Math.round(maxZ)), label: String(Math.min(5, Math.round(maxZ))) });
    return list.filter((m) => m.z >= minZ - 0.02 && m.z <= maxZ + 0.02);
  }, [hasUltra, has2x, uf, minZ, maxZ]);

  if (!visible) return null;

  // % vị trí value trên track
  const pct =
    maxZ > minZ ? ((value - minZ) / (maxZ - minZ)) * 100 : 0;

  return (
    <div
      className="absolute inset-x-0 bottom-4 z-30 pointer-events-none flex justify-center px-4"
      data-zoom-slider="true"
      data-zoom-presets="true"
    >
      <div
        className={`pointer-events-auto w-full max-w-[280px] rounded-2xl px-3 py-2.5
          bg-black/45 backdrop-blur-md border border-white/15 shadow-lg
          ${disabled ? "opacity-50" : ""}`}
      >
        {/* Hàng badge + giá trị */}
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-[10px] font-medium text-white/60 uppercase tracking-wide">
            Zoom
          </span>
          <span
            className="min-w-[2.4rem] text-center text-xs font-semibold text-white
              px-2 py-0.5 rounded-full bg-white/15 border border-white/20"
          >
            {updateZoomBadge(value)}
          </span>
        </div>

        {canSlide ? (
          <>
            {/* Track + fill */}
            <div className="relative h-8 flex items-center">
              <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white/85"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <input
                type="range"
                min={minZ}
                max={maxZ}
                step={0.01}
                value={value}
                disabled={disabled}
                aria-label="Zoom camera"
                aria-valuemin={minZ}
                aria-valuemax={maxZ}
                aria-valuenow={value}
                className="zoom-range absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
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
                onInput={(e) => emit(e.target.value, false)}
              />
              {/* Thumb visual */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full
                  bg-white shadow-md border-2 border-white/90 pointer-events-none z-[5]
                  transition-[left] duration-75 ease-out"
                style={{
                  left: `calc(${pct}% - 10px)`,
                }}
              />
            </div>

            {/* Mốc nhãn — chạm để nhảy nhanh */}
            <div className="relative h-4 mt-0.5">
              {marks.map((m) => {
                const p =
                  maxZ > minZ
                    ? ((m.z - minZ) / (maxZ - minZ)) * 100
                    : 0;
                const active = Math.abs(value - m.z) < 0.12;
                return (
                  <button
                    key={m.label}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      emit(m.z, false);
                      emit(m.z, true);
                    }}
                    className={`absolute -translate-x-1/2 text-[10px] font-semibold transition-colors
                      ${active ? "text-white" : "text-white/50 hover:text-white/80"}`}
                    style={{ left: `${p}%` }}
                  >
                    {m.label}x
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-white/50 text-center py-1">
            Chỉ 1x trên thiết bị này
          </p>
        )}
      </div>
    </div>
  );
};

export default ZoomPresets;
