/**
 * Tap-to-focus / tap-to-meter for MediaStream video tracks.
 *
 * Uses MediaTrackConstraints when the browser exposes them:
 *  - pointsOfInterest (normalized 0–1 sensor coords)
 *  - focusMode: single-shot | continuous | manual
 *  - exposureMode for metering at the same point
 *
 * Support is strongest on Chromium Android; Safari/iOS often has no POI API —
 * callers should still show a reticle for UX; this util fails soft.
 */

/**
 * @param {MediaStream|null|undefined} stream
 * @returns {MediaStreamTrack|null}
 */
function getVideoTrack(stream) {
  try {
    return stream?.getVideoTracks?.()?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * @param {MediaStreamTrack|null} track
 */
export function readFocusCapabilities(track) {
  if (!track || typeof track.getCapabilities !== "function") {
    return {
      focusModes: [],
      exposureModes: [],
      pointsOfInterest: false,
      focusDistance: null,
    };
  }
  let caps = {};
  try {
    caps = track.getCapabilities() || {};
  } catch {
    caps = {};
  }
  const focusModes = Array.isArray(caps.focusMode) ? caps.focusMode : [];
  const exposureModes = Array.isArray(caps.exposureMode)
    ? caps.exposureMode
    : [];
  // Spec: boolean; some UAs omit the key but still accept advanced POI
  const pointsOfInterest =
    caps.pointsOfInterest === true ||
    (Array.isArray(caps.pointsOfInterest) && caps.pointsOfInterest.length > 0);

  let focusDistance = null;
  if (caps.focusDistance && typeof caps.focusDistance === "object") {
    focusDistance = {
      min: Number(caps.focusDistance.min),
      max: Number(caps.focusDistance.max),
      step: Number(caps.focusDistance.step) || undefined,
    };
  }

  return { focusModes, exposureModes, pointsOfInterest, focusDistance };
}

/**
 * Whether this stream can attempt hardware tap-focus / metering.
 * UI reticle may still show even when false.
 * @param {MediaStream|null|undefined} stream
 */
export function canTapToFocus(stream) {
  const track = getVideoTrack(stream);
  if (!track || typeof track.applyConstraints !== "function") return false;
  const c = readFocusCapabilities(track);
  return (
    c.pointsOfInterest ||
    c.focusModes.length > 0 ||
    c.exposureModes.length > 0
  );
}

/**
 * Map a client pointer into normalized video coordinates (0–1).
 * Handles object-cover letterboxing and optional mirror (front camera).
 *
 * @param {HTMLElement} frameEl — outer camera frame (usually the square preview)
 * @param {HTMLVideoElement|null} videoEl
 * @param {number} clientX
 * @param {number} clientY
 * @param {{ mirrored?: boolean }} [opts]
 * @returns {{ x: number, y: number, px: number, py: number } | null}
 *   x/y = 0–1 for constraints; px/py = % for reticle position inside frame
 */
export function pointerToFocusPoint(
  frameEl,
  videoEl,
  clientX,
  clientY,
  opts = {},
) {
  if (!frameEl) return null;
  const rect = frameEl.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  // Position relative to frame (for reticle UI)
  let relX = (clientX - rect.left) / rect.width;
  let relY = (clientY - rect.top) / rect.height;
  relX = Math.min(1, Math.max(0, relX));
  relY = Math.min(1, Math.max(0, relY));

  // Map into video content if object-cover crops edges
  let nx = relX;
  let ny = relY;
  const vw = videoEl?.videoWidth || 0;
  const vh = videoEl?.videoHeight || 0;
  if (vw > 0 && vh > 0) {
    const frameRatio = rect.width / rect.height;
    const videoRatio = vw / vh;
    if (videoRatio > frameRatio) {
      // Video wider than frame — crop left/right
      const visible = frameRatio / videoRatio;
      const offset = (1 - visible) / 2;
      nx = offset + relX * visible;
    } else if (videoRatio < frameRatio) {
      // Video taller — crop top/bottom
      const visible = videoRatio / frameRatio;
      const offset = (1 - visible) / 2;
      ny = offset + relY * visible;
    }
  }

  if (opts.mirrored) {
    nx = 1 - nx;
  }

  nx = Math.min(1, Math.max(0, nx));
  ny = Math.min(1, Math.max(0, ny));

  return {
    x: nx,
    y: ny,
    px: relX * 100,
    py: relY * 100,
  };
}

/**
 * Apply tap-to-focus + exposure metering at normalized point.
 * Soft-fail: never throws.
 *
 * @param {MediaStream|null|undefined} stream
 * @param {number} x — 0–1
 * @param {number} y — 0–1
 * @returns {Promise<{ ok: boolean, method?: string }>}
 */
export async function applyTapToFocus(stream, x, y) {
  const track = getVideoTrack(stream);
  if (!track || typeof track.applyConstraints !== "function") {
    return { ok: false };
  }

  const nx = Math.min(1, Math.max(0, Number(x) || 0));
  const ny = Math.min(1, Math.max(0, Number(y) || 0));
  const poi = [{ x: nx, y: ny }];
  const { focusModes, exposureModes, pointsOfInterest } =
    readFocusCapabilities(track);

  /** @type {MediaTrackConstraints[]} */
  const attempts = [];

  const pickFocus = () => {
    if (focusModes.includes("single-shot")) return "single-shot";
    if (focusModes.includes("manual")) return "manual";
    if (focusModes.includes("continuous")) return "continuous";
    return null;
  };
  const pickExposure = () => {
    if (exposureModes.includes("single-shot")) return "single-shot";
    if (exposureModes.includes("continuous")) return "continuous";
    if (exposureModes.includes("manual")) return "manual";
    return null;
  };

  const fm = pickFocus();
  const em = pickExposure();

  // 1) Best: POI + focus + exposure
  if (pointsOfInterest || fm || em) {
    const advanced = { pointsOfInterest: poi };
    if (fm) advanced.focusMode = fm;
    if (em) advanced.exposureMode = em;
    attempts.push({ advanced: [advanced] });
  }

  // 2) Focus-only (no POI key if UA rejects unknown)
  if (fm) {
    attempts.push({ advanced: [{ focusMode: fm, pointsOfInterest: poi }] });
    attempts.push({ advanced: [{ focusMode: fm }] });
    // Top-level (some Chromium builds)
    attempts.push({ focusMode: fm });
  }

  // 3) Exposure metering only
  if (em) {
    attempts.push({
      advanced: [{ exposureMode: em, pointsOfInterest: poi }],
    });
  }

  // 4) Bare POI — Chromium Android often refocuses with only this
  attempts.push({ advanced: [{ pointsOfInterest: poi }] });

  // 5) single-shot nudge: continuous → single-shot → continuous
  if (focusModes.includes("continuous") && focusModes.includes("single-shot")) {
    attempts.push({
      advanced: [{ focusMode: "single-shot", pointsOfInterest: poi }],
    });
  }

  for (const constraints of attempts) {
    try {
      await track.applyConstraints(constraints);
      // After single-shot / manual, return to continuous if available so AF keeps working
      if (
        focusModes.includes("continuous") &&
        (constraints.advanced?.[0]?.focusMode === "single-shot" ||
          constraints.advanced?.[0]?.focusMode === "manual" ||
          constraints.focusMode === "single-shot" ||
          constraints.focusMode === "manual")
      ) {
        // Brief dwell so single-shot can finish, then continuous
        setTimeout(() => {
          track
            .applyConstraints({
              advanced: [{ focusMode: "continuous" }],
            })
            .catch(() => {
              track
                .applyConstraints({ focusMode: "continuous" })
                .catch(() => {});
            });
        }, 900);
      }
      return { ok: true, method: JSON.stringify(constraints).slice(0, 80) };
    } catch {
      /* try next */
    }
  }

  return { ok: false };
}
