/**
 * Phone-style camera zoom: multi-lens (0.5x ultra-wide) + native track zoom + digital.
 */

/** Read zoom capability from active video track */
export function getTrackZoomCapability(stream) {
  try {
    const track = stream?.getVideoTracks?.()?.[0];
    if (!track) return null;
    const caps =
      typeof track.getCapabilities === "function"
        ? track.getCapabilities()
        : {};
    const settings =
      typeof track.getSettings === "function" ? track.getSettings() : {};

    if (caps.zoom && typeof caps.zoom === "object") {
      const min = Number(caps.zoom.min ?? 1);
      const max = Number(caps.zoom.max ?? 1);
      const step = Number(caps.zoom.step ?? 0.1);
      if (max > min || min < 1) {
        return {
          track,
          min,
          max,
          step: step > 0 ? step : 0.1,
          current: Number(settings.zoom ?? Math.max(min, 1)),
          supported: true,
          // true 0.5-style when browser exposes zoom.min < 1 (some Android)
          hasWideNative: min < 0.95,
        };
      }
    }
    if (typeof caps.zoom === "number" && caps.zoom > 1) {
      return {
        track,
        min: 1,
        max: caps.zoom,
        step: 0.1,
        current: Number(settings.zoom ?? 1),
        supported: true,
        hasWideNative: false,
      };
    }
    return {
      track,
      min: 1,
      max: 1,
      step: 1,
      current: 1,
      supported: false,
      hasWideNative: false,
    };
  } catch {
    return null;
  }
}

/** Apply optical/native zoom on track (supports zoom < 1 for UW on some devices) */
export async function applyTrackZoom(stream, zoomValue) {
  const cap = getTrackZoomCapability(stream);
  if (!cap?.supported || !cap.track) return false;
  const z = Math.min(cap.max, Math.max(cap.min, Number(zoomValue)));
  try {
    await cap.track.applyConstraints({
      advanced: [{ zoom: z }],
    });
    return true;
  } catch {
    try {
      await cap.track.applyConstraints({ zoom: z });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Build discrete zoom steps: 0.5 · 1 · 2 · 3 · …
 * 0.5x only when machine has ultra-wide lens OR native zoom.min < 1.
 *
 * @returns {Array<{ label: string, factor: number, deviceId: string|null, mode: 'lens'|'optical'|'digital' }>}
 */
export function buildZoomSteps({
  facingMode = "user",
  cameras = {},
  trackCap = null,
} = {}) {
  const steps = [];
  const isBack = facingMode === "environment";
  const isFront = facingMode === "user";

  const front = cameras.frontCameras || [];
  const back = cameras.backCameras || [];
  const ultra = cameras.backUltraWideCamera;
  const hasUltra =
    cameras.hasUltraWide ||
    Boolean(ultra) ||
    (cameras.ultraWideDeviceIds || []).length > 0;
  const main =
    cameras.backNormalCamera || (back.length ? back[0] : null) || null;
  const tele = cameras.backZoomCamera || cameras.backTeleCamera;

  if (isFront) {
    // Front ultra-wide if multiple front cams
    if (front.length > 1) {
      steps.push({
        label: "0.5x",
        factor: 0.5,
        deviceId: front[front.length - 1]?.deviceId || front[1]?.deviceId,
        mode: "lens",
      });
    }
    steps.push({
      label: "1x",
      factor: 1,
      deviceId: front[0]?.deviceId || null,
      mode: "lens",
    });
  } else if (isBack) {
    // --- 0.5x ultra-wide (device-dependent) ---
    if (hasUltra && ultra?.deviceId) {
      steps.push({
        label: "0.5x",
        factor: 0.5,
        deviceId: ultra.deviceId,
        mode: "lens",
        ultraCandidates: cameras.ultraWideDeviceIds || [ultra.deviceId],
      });
    } else if (trackCap?.hasWideNative && trackCap.min < 0.95) {
      // Native zoom below 1.0 on same lens (rare but real)
      steps.push({
        label: "0.5x",
        factor: Math.max(trackCap.min, 0.5),
        deviceId: null,
        mode: "optical",
      });
    } else if (back.length >= 2) {
      // Heuristic second back cam as UW
      const uw =
        back.find((d) => d.deviceId !== main?.deviceId) || back[1] || back[0];
      if (uw?.deviceId) {
        steps.push({
          label: "0.5x",
          factor: 0.5,
          deviceId: uw.deviceId,
          mode: "lens",
          ultraCandidates: back
            .map((d) => d.deviceId)
            .filter((id) => id && id !== main?.deviceId),
        });
      }
    }

    steps.push({
      label: "1x",
      factor: 1,
      deviceId: main?.deviceId || back[0]?.deviceId || null,
      mode: "lens",
    });

    if (tele?.deviceId) {
      steps.push({
        label: "2x",
        factor: 2,
        deviceId: tele.deviceId,
        mode: "lens",
      });
    }
  }

  // Optical zoom steps on main lens (factor > 1)
  if (trackCap?.supported && trackCap.max > 1.05) {
    const candidates = [1.5, 2, 3, 5, 8, 10].filter(
      (f) => f >= trackCap.min - 0.01 && f <= trackCap.max + 0.05
    );
    if (trackCap.max >= 1.5) {
      const rounded = Math.round(trackCap.max * 10) / 10;
      if (rounded > 1 && !candidates.some((c) => Math.abs(c - rounded) < 0.15)) {
        candidates.push(rounded);
      }
    }
    for (const f of candidates) {
      const label = `${f % 1 === 0 ? f : f.toFixed(1)}x`;
      if (steps.some((s) => Math.abs(s.factor - f) < 0.08)) continue;
      steps.push({
        label,
        factor: f,
        deviceId: null,
        mode: "optical",
      });
    }
  }

  // Sort + dedupe
  const seen = new Set();
  const unique = [];
  for (const s of steps.sort((a, b) => a.factor - b.factor)) {
    const key = s.factor.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }

  if (!unique.length) {
    unique.push({ label: "1x", factor: 1, deviceId: null, mode: "lens" });
  }

  // No multi-lens and no optical: digital zoom-in only (NOT fake 0.5 — that would crop not widen)
  if (unique.length === 1 && unique[0].factor === 1) {
    unique.push(
      { label: "1.5x", factor: 1.5, deviceId: null, mode: "digital" },
      { label: "2x", factor: 2, deviceId: null, mode: "digital" },
      { label: "3x", factor: 3, deviceId: null, mode: "digital" }
    );
  }

  return unique;
}

export function nextZoomStep(steps, currentLabel, currentFactor = 1) {
  if (!steps?.length) return null;
  let idx = steps.findIndex(
    (s) =>
      s.label === currentLabel || Math.abs(s.factor - currentFactor) < 0.05
  );
  if (idx < 0) idx = 0;
  return steps[(idx + 1) % steps.length];
}
