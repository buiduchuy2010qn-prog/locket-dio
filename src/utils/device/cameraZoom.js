/**
 * Phone-style camera zoom: multi-lens switch + native track zoom + digital fallback.
 */

/** Read zoom capability from active video track (Chrome Android / Safari partial) */
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

    // Standard MediaCapture zoom
    if (caps.zoom && typeof caps.zoom === "object") {
      const min = Number(caps.zoom.min ?? 1);
      const max = Number(caps.zoom.max ?? 1);
      const step = Number(caps.zoom.step ?? 0.1);
      if (max > min) {
        return {
          track,
          min,
          max,
          step: step > 0 ? step : 0.1,
          current: Number(settings.zoom ?? min),
          supported: true,
        };
      }
    }
    // Some browsers expose zoom as number range differently
    if (typeof caps.zoom === "number" && caps.zoom > 1) {
      return {
        track,
        min: 1,
        max: caps.zoom,
        step: 0.1,
        current: Number(settings.zoom ?? 1),
        supported: true,
      };
    }
    return { track, min: 1, max: 1, step: 1, current: 1, supported: false };
  } catch {
    return null;
  }
}

/** Apply optical/native zoom on track */
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
 * Build discrete zoom steps like a phone UI: 0.5 · 1 · 2 · 3 · 5 · max
 * Combines multi-lens deviceIds + native zoom factors.
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
  const main =
    cameras.backNormalCamera ||
    (back.length ? back[0] : null) ||
    null;
  const tele = cameras.backZoomCamera || cameras.backTeleCamera;

  if (isFront) {
    // Front: usually 1x; some phones have ultra-wide front
    if (front.length > 1) {
      steps.push({
        label: "0.5x",
        factor: 0.5,
        deviceId: front[1]?.deviceId || front[0]?.deviceId,
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
    if (ultra) {
      steps.push({
        label: "0.5x",
        factor: 0.5,
        deviceId: ultra.deviceId,
        mode: "lens",
      });
    }
    steps.push({
      label: "1x",
      factor: 1,
      deviceId: main?.deviceId || back[0]?.deviceId || null,
      mode: "lens",
    });
    if (tele) {
      // Physical tele lens — often ~2x optical
      steps.push({
        label: "2x",
        factor: 2,
        deviceId: tele.deviceId,
        mode: "lens",
      });
    }
  }

  // Native optical/digital zoom on current (or main) track
  if (trackCap?.supported && trackCap.max > 1.01) {
    const candidates = [1.5, 2, 3, 5, 8, 10].filter(
      (f) => f >= trackCap.min - 0.01 && f <= trackCap.max + 0.01
    );
    // Always include max if interesting
    if (trackCap.max >= 1.5 && !candidates.includes(Math.round(trackCap.max))) {
      const rounded = Math.round(trackCap.max * 10) / 10;
      if (rounded > 1) candidates.push(rounded);
    }
    for (const f of candidates) {
      const label = `${f % 1 === 0 ? f : f.toFixed(1)}x`;
      // Skip if we already have a lens step with same label
      if (steps.some((s) => s.label === label || Math.abs(s.factor - f) < 0.05)) {
        continue;
      }
      steps.push({
        label,
        factor: f,
        deviceId: null, // stay on current stream, apply zoom
        mode: "optical",
      });
    }
  }

  // Deduplicate by factor, sort ascending
  const seen = new Set();
  const unique = [];
  for (const s of steps.sort((a, b) => a.factor - b.factor)) {
    const key = s.factor.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }

  // Ensure at least 1x
  if (!unique.length) {
    unique.push({ label: "1x", factor: 1, deviceId: null, mode: "lens" });
  }

  // If only 1x, add digital zoom steps for pinch-like control
  if (unique.length === 1 && unique[0].factor === 1) {
    unique.push(
      { label: "1.5x", factor: 1.5, deviceId: null, mode: "digital" },
      { label: "2x", factor: 2, deviceId: null, mode: "digital" },
      { label: "3x", factor: 3, deviceId: null, mode: "digital" }
    );
  }

  return unique;
}

/** Next step in cycle after current label/factor */
export function nextZoomStep(steps, currentLabel, currentFactor = 1) {
  if (!steps?.length) return null;
  let idx = steps.findIndex(
    (s) =>
      s.label === currentLabel || Math.abs(s.factor - currentFactor) < 0.05
  );
  if (idx < 0) idx = 0;
  return steps[(idx + 1) % steps.length];
}
