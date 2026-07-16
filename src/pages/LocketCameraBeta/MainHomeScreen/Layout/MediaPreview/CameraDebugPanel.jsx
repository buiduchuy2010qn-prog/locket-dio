import React, { useCallback, useState } from "react";
import {
  getLastRearProbeReport,
  probeRearCamerasSequential,
  getPreferredWideCameraId,
  isLiveVideoStream,
} from "@/utils";

/**
 * Debug table for multi-rear / PTZ zoom — only when ?cameraDebug=1.
 * Does not use focalLength (not a stable browser API).
 */
export default function CameraDebugPanel({
  streamRef,
  videoRef,
  visible = false,
  onProbeDone,
}) {
  const [rows, setRows] = useState(() => getLastRearProbeReport());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const runProbe = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const preferredId = getPreferredWideCameraId();
      const prev = streamRef?.current || null;
      const result = await probeRearCamerasSequential({
        oldStream: prev,
        videoEl: videoRef?.current || null,
        preferredId,
        stopOld: true,
      });
      setRows(result.rows || []);
      // Hand the winning live stream back to the camera UI if any
      if (result.best?.stream && isLiveVideoStream(result.best.stream)) {
        onProbeDone?.(result);
      } else if (prev && !isLiveVideoStream(prev)) {
        // Previous was stopped by probe; notify parent
        onProbeDone?.(result);
      }
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, streamRef, videoRef, onProbeDone]);

  if (!visible) return null;

  const data = rows.length ? rows : getLastRearProbeReport();

  return (
    <div
      className="absolute inset-x-1 bottom-16 z-[60] max-h-[42%] overflow-auto rounded-lg
        bg-black/80 text-[9px] text-emerald-100 border border-emerald-500/30 p-1.5 pointer-events-auto"
      data-camera-debug="true"
      data-no-focus
    >
      <div className="flex items-center justify-between gap-2 mb-1 sticky top-0 bg-black/90 py-0.5">
        <span className="font-semibold text-emerald-300">
          cameraDebug — rear probe (no focalLength)
        </span>
        <button
          type="button"
          data-no-focus
          disabled={busy}
          onClick={runProbe}
          className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-50 disabled:opacity-40"
        >
          {busy ? "Probing…" : "Probe all rear"}
        </button>
      </div>
      {error && <p className="text-red-300 mb-1">{error}</p>}
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-emerald-400/90">
            <th className="pr-1">label</th>
            <th className="pr-1">id…</th>
            <th className="pr-1">zoom.min</th>
            <th className="pr-1">set.z</th>
            <th className="pr-1">WxH</th>
            <th className="pr-1">facing</th>
            <th className="pr-1">state</th>
            <th>path</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={8} className="opacity-60 py-1">
                Chưa có probe. Bấm “Probe all rear” hoặc góc siêu rộng.
              </td>
            </tr>
          )}
          {data.map((row, i) => (
            <tr key={`${row.deviceId || i}-${i}`} className="border-t border-white/10">
              <td className="pr-1 max-w-[4.5rem] truncate" title={row.label}>
                {row.label || "—"}
              </td>
              <td className="pr-1 font-mono" title={row.deviceId || ""}>
                {row.deviceId ? String(row.deviceId).slice(0, 6) : "—"}
              </td>
              <td className="pr-1">
                {row.capabilitiesZoom?.min != null
                  ? Number(row.capabilitiesZoom.min).toFixed(2)
                  : row.capabilitiesZoom?.empty
                    ? "{}"
                    : "—"}
              </td>
              <td className="pr-1">
                {row.settingsZoom != null
                  ? Number(row.settingsZoom).toFixed(2)
                  : "—"}
              </td>
              <td className="pr-1">
                {row.width && row.height ? `${row.width}×${row.height}` : "—"}
              </td>
              <td className="pr-1">{row.facingMode || "—"}</td>
              <td className="pr-1">{row.trackState || "—"}</td>
              <td className="truncate max-w-[4rem]" title={row.path}>
                {row.path || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 opacity-50">
        groupId logged in console [camera-ptz]. Never CSS-fake ultra-wide.
      </p>
    </div>
  );
}
