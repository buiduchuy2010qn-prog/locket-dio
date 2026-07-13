/**
 * Camera lens selection + pinch zoom system.
 *
 * Rules:
 * - Default rear = main wide @ 1x (never telephoto / macro).
 * - 0.5x → ultra-wide if exposed, else zoom.min.
 * - Pinch: continuous zoom min→max; badge top-left only.
 * - No zoom slider / caption zoom controls.
 * - Stop old tracks before switching lens.
 */

import { getCameraPreviewConstraints } from "./perfProfile";
import { CONFIG } from "@/config";

// ─── Label matchers ───────────────────────────────────────────────

const FRONT_RE =
  /mặt\s*trước|front|user|trước|facing\s*front|selfie|camera2\s*1|camera1\s*1/;

const BACK_RE =
  /mặt\s*sau|back|rear|environment|sau|facing\s*back|outer|world|camera2\s*0|camera1\s*0/;

const AVOID_RE =
  /telephoto|\btele\b|\bzoom\b|macro|depth|portrait|periscope|chụp\s*xa|siêu\s*xa|bokeh|tof|time[\s-]?of[\s-]?flight/;

const ULTRA_RE =
  /cực\s*rộng|ultra\s*wide|ultrawide|ultra\b|0\.5x|0\.5|góc\s*rộng|wide\s*angle|siêu\s*rộng|fisheye|fish\s*eye|uw\b|camera2\s*2/;

const TELE_RE =
  /chụp\s*xa|telephoto|\btele\b|periscope|\b2x\b|\b3x\b|\b5x\b|\b10x\b|camera2\s*[3-9]/;

const MAIN_HINT_RE =
  /\b1x\b|main|primary|standard|bình\s*thường|camera\s*kép|\bwide\b(?!\s*angle)|default|rear\s*camera|back\s*camera/;

const PREFER_RE =
  /back\s*camera|rear\s*camera|\bwide\b(?!\s*angle)|main|environment|primary|standard/;

/** Preset buttons only — no Max pill, no slider */
export const ZOOM_PRESETS = ["0.5x", "1x", "2x"];
export const ZOOM_MODES = ZOOM_PRESETS;

// ─── Labels ───────────────────────────────────────────────────────

export function isUltraLabel(label = "") {
  return ULTRA_RE.test(String(label).toLowerCase());
}

export function isTeleLabel(label = "") {
  const l = String(label).toLowerCase();
  return TELE_RE.test(l) && !isUltraLabel(l);
}

export function isAvoidLabel(label = "") {
  const l = String(label).toLowerCase();
  if (isUltraLabel(l)) return true;
  return AVOID_RE.test(l);
}

export function isFrontLabel(label = "") {
  return FRONT_RE.test(String(label).toLowerCase());
}

export function isBackLabel(label = "") {
  return BACK_RE.test(String(label).toLowerCase());
}

function scoreMainCamera(device, index, total) {
  const label = (device.label || "").toLowerCase();
  let score = 50;

  if (isUltraLabel(label)) score -= 100;
  else if (isTeleLabel(label) || AVOID_RE.test(label)) score -= 80;
  else score += 40;

  if (MAIN_HINT_RE.test(label) || PREFER_RE.test(label)) score += 30;
  if (total >= 2 && index === 0 && isUltraLabel(label)) score -= 40;
  if (
    total >= 2 &&
    index === 1 &&
    !isUltraLabel(label) &&
    !isTeleLabel(label) &&
    !AVOID_RE.test(label)
  ) {
    score += 25;
  }
  if (total >= 3 && index === total - 1 && isTeleLabel(label)) score -= 10;

  return score;
}

// ─── Permission + enumeration ─────────────────────────────────────

export async function requestCameraPermission() {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  }
}

export async function getVideoInputDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput");
}

export async function ensureLabeledVideoDevices() {
  let devices = await getVideoInputDevices();
  if (!devices.some((d) => d.label)) {
    await requestCameraPermission();
    devices = await getVideoInputDevices();
  }
  return devices;
}

/**
 * Detect and classify all cameras (required API name).
 */
export async function detectCameraDevices() {
  const devices = await ensureLabeledVideoDevices();
  return detectRearCameras(devices);
}

export function detectRearCameras(videoDevices = []) {
  const front = [];
  const rear = [];

  for (const device of videoDevices) {
    const label = device.label || "";
    if (isFrontLabel(label)) front.push(device);
    else if (isBackLabel(label)) rear.push(device);
  }

  const remaining = videoDevices.filter(
    (d) =>
      !front.some((c) => c.deviceId === d.deviceId) &&
      !rear.some((c) => c.deviceId === d.deviceId),
  );

  if (!rear.length && remaining.length) {
    if (remaining.length >= 2) {
      rear.push(remaining[remaining.length - 1]);
      if (!front.length) front.push(remaining[0]);
    } else {
      rear.push(remaining[0]);
    }
  }

  if (!front.length) {
    const fb = videoDevices.find(
      (d) => !rear.some((c) => c.deviceId === d.deviceId),
    );
    if (fb) front.push(fb);
  }

  const main = pickMainRearCamera(rear);
  const telephoto = pickTeleCamera(rear, main);
  const ultrawide = pickUltraWideCamera(rear, main, telephoto);

  return {
    all: videoDevices,
    front,
    rear,
    main,
    ultrawide,
    telephoto,
  };
}

export function pickMainRearCamera(rearCameras = []) {
  if (!rearCameras.length) return null;
  const scored = rearCameras.map((device, index) => ({
    device,
    score: scoreMainCamera(device, index, rearCameras.length),
    label: (device.label || "").toLowerCase(),
  }));
  const preferred = scored.filter(
    (s) =>
      !isUltraLabel(s.label) &&
      !isTeleLabel(s.label) &&
      !AVOID_RE.test(s.label),
  );
  const pool = (preferred.length ? preferred : scored).slice();
  pool.sort((a, b) => b.score - a.score);
  return pool[0]?.device || rearCameras[0] || null;
}

/**
 * Ultra-wide picker.
 * 1) Explicit label (ultra wide / 0.5 / camera2 2 …)
 * 2) Heuristic: multi rear — non-main, non-tele, prefer lower index
 *    (Android often lists ultra before main).
 */
export function pickUltraWideCamera(
  rearCameras = [],
  mainCamera = null,
  teleCamera = null,
) {
  if (!rearCameras.length) return null;

  const byLabel = rearCameras.find((d) => isUltraLabel(d.label || ""));
  if (byLabel) return byLabel;

  const mainId = mainCamera?.deviceId || pickMainRearCamera(rearCameras)?.deviceId;
  const teleId =
    teleCamera?.deviceId ||
    rearCameras.find((d) => isTeleLabel(d.label || ""))?.deviceId ||
    null;

  // Need at least one other rear lens that isn't main/tele
  const others = rearCameras.filter(
    (d) =>
      d.deviceId !== mainId &&
      d.deviceId !== teleId &&
      !isTeleLabel(d.label || "") &&
      !AVOID_RE.test((d.label || "").toLowerCase()),
  );

  if (!others.length) {
    // 2 rear only, no labels: treat the non-main as ultra candidate
    // (common dual: ultra + main). Skip if the other looks like tele.
    if (rearCameras.length >= 2 && mainId) {
      const other = rearCameras.find(
        (d) => d.deviceId !== mainId && !isTeleLabel(d.label || ""),
      );
      // Only trust heuristic when we have 2+ rear and other isn't clearly tele
      if (other && rearCameras.length >= 2) {
        // Prefer other if it appears earlier in list (index 0 = ultra pattern)
        const mainIdx = rearCameras.findIndex((d) => d.deviceId === mainId);
        const otherIdx = rearCameras.findIndex((d) => d.deviceId === other.deviceId);
        if (otherIdx >= 0 && (otherIdx < mainIdx || rearCameras.length === 2)) {
          return other;
        }
      }
    }
    return null;
  }

  // Prefer earliest index among candidates (Android ultra often first back cam)
  others.sort((a, b) => {
    const ia = rearCameras.findIndex((d) => d.deviceId === a.deviceId);
    const ib = rearCameras.findIndex((d) => d.deviceId === b.deviceId);
    return ia - ib;
  });
  return others[0];
}

export function pickTeleCamera(rearCameras = [], mainCamera = null) {
  if (!rearCameras.length) return null;
  const byLabel = rearCameras.find((d) => isTeleLabel(d.label || ""));
  if (byLabel) return byLabel;

  // 3+ rear, no labels: last non-main often tele
  if (rearCameras.length >= 3) {
    const mainId = mainCamera?.deviceId || pickMainRearCamera(rearCameras)?.deviceId;
    const last = [...rearCameras].reverse().find((d) => d.deviceId !== mainId);
    return last || null;
  }
  return null;
}

export function classifyLensType(device, detected) {
  if (!device) return "unknown";
  if (detected?.main?.deviceId === device.deviceId) return "main";
  if (detected?.ultrawide?.deviceId === device.deviceId) return "ultrawide";
  if (detected?.telephoto?.deviceId === device.deviceId) return "telephoto";
  const label = device.label || "";
  if (isUltraLabel(label)) return "ultrawide";
  if (isTeleLabel(label) || AVOID_RE.test(label.toLowerCase())) return "telephoto";
  if (isBackLabel(label) || PREFER_RE.test(label.toLowerCase())) return "main";
  return "unknown";
}

// ─── Stream helpers ───────────────────────────────────────────────

export function getActiveVideoTrack(stream) {
  return stream?.getVideoTracks?.()?.[0] || null;
}

export function getCurrentTrackCapabilities(stream) {
  try {
    return getActiveVideoTrack(stream)?.getCapabilities?.() || {};
  } catch {
    return {};
  }
}

export function getCurrentTrackSettings(stream) {
  try {
    return getActiveVideoTrack(stream)?.getSettings?.() || {};
  } catch {
    return {};
  }
}

export function supportsHardwareZoom(stream) {
  const caps = getCurrentTrackCapabilities(stream);
  return Boolean(caps?.zoom && typeof caps.zoom.max === "number");
}

export function readZoomRange(stream) {
  const caps = getCurrentTrackCapabilities(stream);
  if (!caps?.zoom) {
    return { minZoom: 1, maxZoom: 1, zoomStep: 0.1, supported: false };
  }
  return {
    minZoom: caps.zoom.min ?? 1,
    maxZoom: caps.zoom.max ?? 1,
    zoomStep: caps.zoom.step ?? 0.1,
    supported: true,
  };
}

/** Required API: zoom capabilities of current track */
export function getCameraZoomCapabilities(stream) {
  return readZoomRange(stream);
}

export function stopCurrentCamera(stream, videoEl = null) {
  if (stream) {
    try {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
  }
  if (videoEl) {
    try {
      videoEl.srcObject = null;
    } catch {
      /* ignore */
    }
  }
}

function highResQuality(base = {}) {
  const preview = getCameraPreviewConstraints(base);
  return {
    ...preview,
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 1280, max: 1920 },
  };
}

/** Constraint siêu nhẹ khi flip cam — mở nhanh, preview đủ dùng */
function flipFastQuality() {
  return {
    width: { ideal: 640, max: 960 },
    height: { ideal: 640, max: 960 },
    frameRate: { ideal: 24, max: 30 },
  };
}

export async function startCameraByDeviceId(deviceId, options = {}) {
  const {
    facingMode = "environment",
    // Default false: preview mượt; chụp/quay vẫn lấy frame từ track
    highRes = false,
    preferDeviceId = true,
    // Flip front↔rear: constraint nhẹ + facingMode-first
    fast = false,
  } = options;

  const quality = highRes
    ? highResQuality(CONFIG?.app?.camera?.constraints?.default || {})
    : fast
      ? flipFastQuality()
      : getCameraPreviewConstraints(
          CONFIG?.app?.camera?.constraints?.default || {},
        );

  const tryOpen = async (video) =>
    navigator.mediaDevices.getUserMedia({ video, audio: false });

  // Flip: facingMode ideal trước (nhanh nhất trên mobile), deviceId optional
  if (fast) {
    try {
      if (deviceId && preferDeviceId) {
        return await tryOpen({
          deviceId: { ideal: deviceId },
          facingMode: { ideal: facingMode },
          ...quality,
        });
      }
      return await tryOpen({
        facingMode: { ideal: facingMode },
        ...quality,
      });
    } catch {
      try {
        return await tryOpen({ facingMode: { ideal: facingMode }, ...quality });
      } catch {
        /* fall through to normal path */
      }
    }
  }

  // Fast path: ideal (ít fail/retry → mở cam nhanh)
  // exact chỉ khi cần khóa lens (ultra/tele)
  if (preferDeviceId && deviceId) {
    try {
      return await tryOpen({
        deviceId: { ideal: deviceId },
        facingMode: { ideal: facingMode },
        ...quality,
      });
    } catch {
      try {
        return await tryOpen({ deviceId: { exact: deviceId }, ...quality });
      } catch {
        /* fall through */
      }
    }
  }

  try {
    return await tryOpen({ facingMode: { ideal: facingMode }, ...quality });
  } catch {
    try {
      return await tryOpen({ facingMode: { exact: facingMode }, ...quality });
    } catch {
      /* fall through */
    }
  }

  if (deviceId) {
    try {
      return await tryOpen({ deviceId: { ideal: deviceId }, ...quality });
    } catch {
      /* ignore */
    }
  }

  return tryOpen({ facingMode: { ideal: facingMode }, ...quality });
}

/** Clamp zoom to [min, max] */
export function clampZoom(value, minZoom = 1, maxZoom = 1) {
  const v = Number(value);
  if (!Number.isFinite(v)) return minZoom;
  return Math.max(minZoom, Math.min(v, maxZoom));
}

/**
 * Apply digital / hardware zoom (required API).
 * @returns {Promise<number|false>}
 */
/** Cache min/max/last zoom theo track — tránh getCapabilities mỗi frame pinch */
const trackZoomCache = new WeakMap();

export async function applyCameraZoom(stream, zoomValue) {
  return setCameraZoom(stream, zoomValue);
}

export async function setCameraZoom(stream, value) {
  const track = getActiveVideoTrack(stream);
  if (!track) return false;

  let cached = trackZoomCache.get(track);
  if (!cached) {
    const caps = getCurrentTrackCapabilities(stream);
    if (!caps?.zoom) return false;
    cached = {
      min: caps.zoom.min ?? 1,
      max: caps.zoom.max ?? 1,
      last: null,
    };
    trackZoomCache.set(track, cached);
  }

  const next = clampZoom(value, cached.min, cached.max);
  // Bỏ qua apply nếu gần như không đổi — giảm jank
  if (cached.last != null && Math.abs(cached.last - next) < 0.015) {
    return cached.last;
  }

  try {
    await track.applyConstraints({ advanced: [{ zoom: next }] });
    cached.last = next;
    return next;
  } catch {
    try {
      await track.applyConstraints({ zoom: next });
      cached.last = next;
      return next;
    } catch {
      return false;
    }
  }
}

/** Clear zoom cache when stream stops (optional) */
export function clearTrackZoomCache(stream) {
  const track = getActiveVideoTrack(stream);
  if (track) trackZoomCache.delete(track);
}

/** Format badge text: 0.5x, 1x, 1.4x, 2x, 5x */
export function updateZoomBadge(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "1x";
  if (Math.abs(n - 1) < 0.05) return "1x";
  if (Math.abs(n - 0.5) < 0.05) return "0.5x";
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.05) {
    return `${Math.round(n)}x`;
  }
  return `${Number(n.toFixed(1))}x`;
}

export function formatZoomModeLabel(mode) {
  if (mode === "0.5x") return "0.5";
  if (mode === "1x") return "1x";
  if (mode === "2x") return "2x";
  if (mode === "max") return "Max";
  return String(mode);
}

// ─── Pinch helpers ────────────────────────────────────────────────

export function getTouchDistance(touches) {
  if (!touches || touches.length < 2) return 0;
  const a = touches[0];
  const b = touches[1];
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

/**
 * Pinch start state.
 * @returns {{ active, distance, zoom, isPinching }}
 */
export function handlePinchZoomStart(touches, currentZoom) {
  if (!touches || touches.length < 2) {
    return { active: false, distance: 0, zoom: currentZoom, isPinching: false };
  }
  return {
    active: true,
    distance: getTouchDistance(touches),
    zoom: currentZoom,
    isPinching: true,
  };
}

/**
 * Compute next zoom from pinch move (does not apply constraints).
 */
export function handlePinchZoomMove(touches, pinchState, minZoom, maxZoom) {
  if (!pinchState?.active || !touches || touches.length < 2) {
    return { zoom: pinchState?.zoom ?? 1, distance: pinchState?.distance ?? 0 };
  }
  const nextDistance = getTouchDistance(touches);
  if (!nextDistance || !pinchState.distance) {
    return { zoom: pinchState.zoom, distance: pinchState.distance };
  }
  const scale = nextDistance / pinchState.distance;
  const raw = pinchState.zoom * scale;
  return {
    zoom: clampZoom(raw, minZoom, maxZoom),
    distance: nextDistance,
  };
}

export function handlePinchZoomEnd() {
  return { active: false, distance: 0, zoom: 0, isPinching: false };
}

/**
 * Ensure no caption-area zoom controls exist (DOM cleanup guard).
 * Call after mount; safe no-op if none found.
 */
export function removeCaptionZoomControls(root = document) {
  if (typeof document === "undefined") return;
  try {
    const selectors = [
      "[data-zoom-slider]",
      "[data-caption-zoom]",
      ".caption-zoom",
      ".caption-zoom-bar",
      ".zoom-slider",
      ".zoom-bar",
      'input[type="range"][data-camera-zoom]',
      ".editor-caption .zoom-control",
      ".editor-caption input[type='range']",
    ];
    for (const sel of selectors) {
      root.querySelectorAll?.(sel)?.forEach((el) => {
        try {
          el.remove();
        } catch {
          /* ignore */
        }
      });
    }
  } catch {
    /* ignore */
  }
}

// ─── Available modes + resolve ────────────────────────────────────

export function computeAvailableZoomModes(detected, stream) {
  const range = readZoomRange(stream);
  const modes = {
    "0.5x": false,
    "1x": true,
    "2x": false,
  };

  // Always show 0.5 in UI if ultra OR digital min < 1; else keep button
  // but mark disabled only when neither works — still try min
  if (detected?.ultrawide?.deviceId) modes["0.5x"] = true;
  else if (range.supported && range.minZoom < 0.95) modes["0.5x"] = true;
  // Keep 0.5 visible as soft-available when rear multi-cam may expose later
  else if (detected?.rear?.length >= 2) modes["0.5x"] = true;

  if (detected?.telephoto?.deviceId) modes["2x"] = true;
  else if (range.supported && range.maxZoom >= 1.8) modes["2x"] = true;
  // Soft enable 2x when zoom range exists
  else if (range.supported && range.maxZoom > range.minZoom + 0.2) {
    modes["2x"] = true;
  }

  return modes;
}

export function resolveZoomModeTarget(mode, ctx = {}) {
  const { detected, stream, facingMode = "environment" } = ctx;
  const isBack = facingMode === "environment";
  const range = readZoomRange(stream);

  const mainId = detected?.main?.deviceId || detected?.rear?.[0]?.deviceId || null;
  const ultraId = detected?.ultrawide?.deviceId || null;
  const teleId = detected?.telephoto?.deviceId || null;
  const frontId = detected?.front?.[0]?.deviceId || null;

  if (!isBack) {
    return {
      deviceId: frontId,
      digitalZoom: 1,
      displayZoom: 1,
      lensType: "unknown",
      mode: "1x",
    };
  }

  const m = String(mode || "1x").toLowerCase();

  if (m === "0.5x" || m === "0.5") {
    if (ultraId) {
      return {
        deviceId: ultraId,
        digitalZoom: 1,
        displayZoom: 0.5,
        lensType: "ultrawide",
        mode: "0.5x",
      };
    }
    if (range.supported && range.minZoom < 0.95) {
      return {
        deviceId: mainId,
        digitalZoom: range.minZoom,
        displayZoom: range.minZoom,
        lensType: "main",
        mode: "0.5x",
      };
    }
    return {
      deviceId: null,
      digitalZoom: null,
      displayZoom: null,
      lensType: null,
      mode: "0.5x",
      unavailable: true,
    };
  }

  if (m === "2x" || m === "2") {
    // Prefer digital 2 on main; tele only if no digital zoom path
    if (range.supported && range.maxZoom >= 1.8) {
      return {
        deviceId: mainId,
        digitalZoom: Math.min(2, range.maxZoom),
        displayZoom: Math.min(2, range.maxZoom),
        lensType: "main",
        mode: "2x",
      };
    }
    if (teleId) {
      return {
        deviceId: teleId,
        digitalZoom: 1,
        displayZoom: 2,
        lensType: "telephoto",
        mode: "2x",
      };
    }
    return {
      deviceId: null,
      digitalZoom: null,
      displayZoom: null,
      lensType: null,
      mode: "2x",
      unavailable: true,
    };
  }

  // 1x — ALWAYS main
  return {
    deviceId: mainId,
    digitalZoom: range.supported && range.minZoom <= 1 && range.maxZoom >= 1 ? 1 : range.minZoom || 1,
    displayZoom: 1,
    lensType: "main",
    mode: "1x",
  };
}

/**
 * Global pinch range across lenses.
 * min: 0.5 if ultra OR track min < 1 OR multi-rear heuristic
 * max: track max (or higher if tele)
 */
export function getEffectiveZoomBounds(detected, stream) {
  const range = readZoomRange(stream);
  let min = range.supported ? range.minZoom : 1;
  let max = range.supported ? range.maxZoom : 1;

  const hasUltra = Boolean(detected?.ultrawide?.deviceId);
  const multiRear = (detected?.rear?.length || 0) >= 2;

  // Physical ultra or multi-lens → allow pinch down to 0.5
  if (hasUltra || multiRear) {
    min = Math.min(min, 0.5);
  }
  if (range.supported && range.minZoom < 0.95) {
    min = Math.min(min, range.minZoom);
  }
  if (detected?.telephoto?.deviceId && max < 2) {
    max = Math.max(max, 2);
  }
  if (range.supported && range.maxZoom > max) {
    max = range.maxZoom;
  }

  // Always allow at least 1x on the range
  if (min > 1) min = 1;
  if (max < 1) max = 1;
  // Ensure room to pinch out from 1x when hardware zoom exists
  if (range.supported && max < range.maxZoom) max = range.maxZoom;

  return {
    minZoom: min,
    maxZoom: max,
    trackSupported: range.supported,
    trackMin: range.minZoom,
    trackMax: range.maxZoom,
    step: range.zoomStep,
    hasUltra,
    canGo05: min < 0.9 || hasUltra || multiRear,
  };
}

/**
 * Map display zoom → which lens + track zoom to apply.
 * Never uses tele by default; tele only when displayZoom >= ~2 and no digital.
 */
export function mapDisplayZoomToLens(displayZoom, detected, stream) {
  const z = Number(displayZoom) || 1;
  const mainId = detected?.main?.deviceId || detected?.rear?.[0]?.deviceId || null;
  const ultraId = detected?.ultrawide?.deviceId || null;
  const teleId = detected?.telephoto?.deviceId || null;
  const range = readZoomRange(stream);

  // ── 0.5 band: ultra lens first, then digital min ──
  if (z < 0.92) {
    if (ultraId) {
      return {
        deviceId: ultraId,
        digitalZoom: 1,
        displayZoom: Math.min(z, 0.5) < 0.6 ? 0.5 : z,
        lensType: "ultrawide",
        mode: "0.5x",
        switchDevice: true,
      };
    }
    if (range.supported && range.minZoom < 0.95) {
      return {
        deviceId: mainId,
        digitalZoom: clampZoom(
          Math.max(z, range.minZoom),
          range.minZoom,
          range.maxZoom,
        ),
        displayZoom: z,
        lensType: "main",
        mode: "0.5x",
        switchDevice: false,
      };
    }
    // No ultra & no digital-out → stay main at min (cannot go wider)
    return {
      deviceId: mainId,
      digitalZoom: range.supported ? range.minZoom : 1,
      displayZoom: range.supported && range.minZoom < 1 ? range.minZoom : 1,
      lensType: "main",
      mode: range.supported && range.minZoom < 0.95 ? "0.5x" : "1x",
      switchDevice: false,
      unavailable05: !range.supported || range.minZoom >= 0.95,
    };
  }

  // High zoom: use track max on main first; tele only if track can't reach
  if (z >= 1.9 && teleId && (!range.supported || range.maxZoom < 1.8)) {
    return {
      deviceId: teleId,
      digitalZoom: 1,
      displayZoom: z,
      lensType: "telephoto",
      mode: "2x",
      switchDevice: true,
    };
  }

  // Main band with digital zoom — leave ultra when zooming back up
  let digital = 1;
  if (range.supported) {
    digital = clampZoom(Math.max(z, range.minZoom), range.minZoom, range.maxZoom);
  }

  let mode = "1x";
  if (z >= 1.7) mode = "2x";

  return {
    deviceId: mainId,
    digitalZoom: digital,
    displayZoom: z,
    lensType: "main",
    mode,
    switchDevice: Boolean(ultraId), // may need to leave ultra
  };
}

export async function ensureMainCameraStream(stream, mainDeviceId, detected) {
  if (!stream || !mainDeviceId) return stream;

  const settings = getCurrentTrackSettings(stream);
  const actualId = settings.deviceId;
  if (!actualId || actualId === mainDeviceId) return stream;

  const device =
    detected?.all?.find((d) => d.deviceId === actualId) ||
    detected?.rear?.find((d) => d.deviceId === actualId);

  const lens = classifyLensType(device, detected);
  const label = (device?.label || "").toLowerCase();
  const wrongLens =
    lens === "ultrawide" ||
    lens === "telephoto" ||
    isUltraLabel(label) ||
    isTeleLabel(label) ||
    AVOID_RE.test(label);

  if (!wrongLens) return stream;

  stopCurrentCamera(stream);
  try {
    return await startCameraByDeviceId(mainDeviceId, {
      facingMode: "environment",
      highRes: false,
      preferDeviceId: true,
    });
  } catch {
    try {
      return await startCameraByDeviceId(null, {
        facingMode: "environment",
        highRes: false,
        preferDeviceId: false,
      });
    } catch {
      return null;
    }
  }
}

/** Open main rear @ 1x */
export async function startMainCameraX1(options = {}) {
  const { oldStream = null, videoEl = null } = options;
  if (oldStream) stopCurrentCamera(oldStream, videoEl);

  const detected = await detectCameraDevices();
  const main = detected.main || detected.rear[0] || null;
  const mainId = main?.deviceId || null;

  let stream = await startCameraByDeviceId(mainId, {
    facingMode: "environment",
    highRes: false,
    preferDeviceId: Boolean(mainId),
  });

  stream = await ensureMainCameraStream(stream, mainId, detected);
  if (!stream) throw new Error("Failed to open main rear camera");

  if (supportsHardwareZoom(stream)) {
    const range = readZoomRange(stream);
    const one = range.minZoom <= 1 && range.maxZoom >= 1 ? 1 : range.minZoom;
    await applyCameraZoom(stream, one);
  }

  return {
    stream,
    detected,
    deviceId: getCurrentTrackSettings(stream).deviceId || mainId,
    lensType: "main",
    zoomMode: "1x",
    currentZoom: 1,
    ...readZoomRange(stream),
    availableZoomModes: computeAvailableZoomModes(detected, stream),
  };
}

export async function resetToMainCameraX1(options = {}) {
  return startMainCameraX1(options);
}

/** Switch to ultra-wide 0.5x */
export async function switchToUltraWide05(options = {}) {
  const { oldStream = null, videoEl = null, detected: detIn = null } = options;
  const detected = detIn || (await detectCameraDevices());
  const ultraId = detected.ultrawide?.deviceId || null;

  if (ultraId) {
    if (oldStream) stopCurrentCamera(oldStream, videoEl);
    const stream = await startCameraByDeviceId(ultraId, {
      facingMode: "environment",
      highRes: false,
      preferDeviceId: true,
    });
    return {
      stream,
      detected,
      deviceId: ultraId,
      lensType: "ultrawide",
      zoomMode: "0.5x",
      currentZoom: 0.5,
      digitalZoom: 1,
    };
  }

  // Fallback: digital min on current/main
  if (oldStream && supportsHardwareZoom(oldStream)) {
    const range = readZoomRange(oldStream);
    if (range.minZoom < 0.95) {
      const applied = await applyCameraZoom(oldStream, range.minZoom);
      return {
        stream: oldStream,
        detected,
        deviceId: getCurrentTrackSettings(oldStream).deviceId,
        lensType: "main",
        zoomMode: "0.5x",
        currentZoom: applied || range.minZoom,
        digitalZoom: applied || range.minZoom,
        switchedDevice: false,
      };
    }
  }

  return { unavailable: true, detected };
}

/** Switch back to main 1x */
export async function switchToMainCamera1x(options = {}) {
  return startMainCameraX1(options);
}

export async function detectAndClassifyCameras() {
  const d = await detectCameraDevices();
  return {
    allCameras: d.all,
    frontCameras: d.front,
    backCameras: d.rear,
    backNormalCamera: d.main,
    backUltraWideCamera: d.ultrawide,
    backZoomCamera: d.telephoto,
    detected: d,
  };
}

export async function switchToZoomMode(mode, ctx = {}) {
  const {
    stream,
    detected,
    facingMode = "environment",
    currentDeviceId = null,
  } = ctx;

  const target = resolveZoomModeTarget(mode, {
    detected,
    stream,
    facingMode,
  });

  if (target.unavailable) {
    return { ok: false, reason: "unavailable", mode };
  }

  const needSwitchDevice =
    target.deviceId &&
    currentDeviceId &&
    target.deviceId !== currentDeviceId;

  return {
    ok: true,
    mode: target.mode,
    deviceId: target.deviceId,
    digitalZoom: target.digitalZoom,
    displayZoom: target.displayZoom,
    lensType: target.lensType,
    needDeviceSwitch: Boolean(
      target.deviceId && (!stream || needSwitchDevice || !currentDeviceId),
    ),
  };
}

// ─── Front / selfie camera (facingMode: "user") ─────────────────
// Front has NO 0.5x ultra. Default 1x only. Zoom only if track supports it.

/**
 * Zoom bounds for front camera only — never inherit rear ultra min 0.5.
 */
export function refreshFrontCameraZoomCapabilities(stream) {
  const range = readZoomRange(stream);
  let minZoom = range.supported ? range.minZoom : 1;
  let maxZoom = range.supported ? range.maxZoom : 1;
  // Front camera: floor at 1x (no ultra-wide 0.5)
  if (minZoom < 1) minZoom = 1;
  if (maxZoom < minZoom) maxZoom = minZoom;
  return {
    minZoom,
    maxZoom,
    zoomStep: range.zoomStep || 0.1,
    supported: range.supported && maxZoom > minZoom + 0.01,
    trackMin: range.minZoom,
    trackMax: range.maxZoom,
  };
}

/** Reset front zoom to 1x (or track min if min > 1). */
export async function resetFrontCameraZoom(stream) {
  const caps = refreshFrontCameraZoomCapabilities(stream);
  const one =
    caps.minZoom <= 1 && caps.maxZoom >= 1 ? 1 : caps.minZoom;
  if (caps.supported || supportsHardwareZoom(stream)) {
    const applied = await applyCameraZoom(stream, one);
    return applied === false ? one : applied;
  }
  return 1;
}

/** Apply zoom on front track only — clamped to front capabilities. */
export async function applyFrontCameraZoom(stream, zoomValue) {
  const caps = refreshFrontCameraZoomCapabilities(stream);
  if (!supportsHardwareZoom(stream)) return false;
  const clamped = clampZoom(zoomValue, caps.minZoom, caps.maxZoom);
  return applyCameraZoom(stream, clamped);
}

export function handleFrontCameraPinchStart(touches, currentZoom) {
  // Never start below 1x for front
  const z = Math.max(1, Number(currentZoom) || 1);
  return handlePinchZoomStart(touches, z);
}

export function handleFrontCameraPinchMove(
  touches,
  pinchState,
  minZoom,
  maxZoom,
) {
  // Enforce front floor ≥ 1
  const min = Math.max(1, minZoom ?? 1);
  const max = Math.max(min, maxZoom ?? 1);
  return handlePinchZoomMove(touches, pinchState, min, max);
}

export function handleFrontCameraPinchEnd() {
  return handlePinchZoomEnd();
}

/**
 * Open front camera (facingMode user).
 * Giữ oldStream đến khi cam mới sẵn sàng → flip không màn đen / không chờ stop.
 * Always starts at 1x. Does not use rear lens selection.
 */
export async function startFrontCamera(options = {}) {
  const {
    oldStream = null,
    videoEl = null,
    deviceId = null,
    fast = true,
  } = options;

  // Mở cam mới TRƯỚC — không stop old (tránh black + double latency)
  const stream = await startCameraByDeviceId(deviceId || null, {
    facingMode: "user",
    highRes: false,
    preferDeviceId: Boolean(deviceId),
    fast,
  });

  // Stop old sau khi new ready — không clear videoEl (caller gán srcObject)
  if (oldStream && oldStream !== stream) {
    clearTrackZoomCache(oldStream);
    stopCurrentCamera(oldStream, null);
  }

  // Zoom 1x nền — không await (mở preview ngay)
  resetFrontCameraZoom(stream).catch(() => {});
  const caps = refreshFrontCameraZoomCapabilities(stream);
  const settings = getCurrentTrackSettings(stream);

  return {
    stream,
    deviceId: settings.deviceId || deviceId,
    facingMode: "user",
    lensType: "front",
    zoomMode: "1x",
    currentZoom: 1,
    minZoom: caps.minZoom,
    maxZoom: caps.maxZoom,
    zoomStep: caps.zoomStep,
    zoomSupported: caps.supported,
  };
}

/** Switch to front: stop old, open user-facing @ 1x. */
export async function switchToFrontCamera(options = {}) {
  return startFrontCamera(options);
}
