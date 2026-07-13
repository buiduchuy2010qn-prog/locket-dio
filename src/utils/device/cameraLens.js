/**
 * Camera lens selection + zoom system.
 *
 * Rules:
 * - Default rear = main wide @ 1x (never telephoto / macro / depth).
 * - 0.5x → ultra-wide device if exposed, else digital zoom.min.
 * - 2x → tele only when user selects it; else digital zoom 2.
 * - Max → capabilities.zoom.max (hardware zoom only).
 * - Always stop old tracks before opening a new camera.
 */

import { getCameraPreviewConstraints } from "./perfProfile";
import { CONFIG } from "@/config";

// ─── Label matchers ───────────────────────────────────────────────

const FRONT_RE =
  /mặt\s*trước|front|user|trước|facing\s*front|selfie|camera2\s*1|camera1\s*1/;

const BACK_RE =
  /mặt\s*sau|back|rear|environment|sau|facing\s*back|outer|world|camera2\s*0|camera1\s*0/;

/** Lenses we never want as default (and avoid for 1x) */
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

export const ZOOM_MODES = ["0.5x", "1x", "2x", "max"];

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

  // Multi-cam Android: index 0 back is often ultra → penalize if ultra-ish
  if (total >= 2 && index === 0 && isUltraLabel(label)) score -= 40;
  // Index 1 often main on multi-cam phones
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

/**
 * Request camera permission (prefer rear environment, low-res probe).
 * Stops the probe stream. Returns true if granted.
 */
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

/** Enumerate videoinput devices (labels require prior permission). */
export async function getVideoInputDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput");
}

/**
 * Ensure labels exist: request permission once if needed, re-enumerate.
 */
export async function ensureLabeledVideoDevices() {
  let devices = await getVideoInputDevices();
  const hasLabels = devices.some((d) => d.label);
  if (!hasLabels) {
    await requestCameraPermission();
    devices = await getVideoInputDevices();
  }
  return devices;
}

// ─── Detection / pick ─────────────────────────────────────────────

/**
 * Split devices into front / rear and typed rear lenses.
 * @returns {{
 *   all: MediaDeviceInfo[],
 *   front: MediaDeviceInfo[],
 *   rear: MediaDeviceInfo[],
 *   main: MediaDeviceInfo|null,
 *   ultrawide: MediaDeviceInfo|null,
 *   telephoto: MediaDeviceInfo|null,
 * }}
 */
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
      // Dual unlabeled: last often rear, first often front
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

  const ultrawide = pickUltraWideCamera(rear);
  const telephoto = pickTeleCamera(rear);
  const main = pickMainRearCamera(rear);

  return {
    all: videoDevices,
    front,
    rear,
    main,
    ultrawide,
    telephoto,
  };
}

/** Prefer main rear / wide — never ultra / tele / macro / depth. */
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

export function pickUltraWideCamera(rearCameras = []) {
  if (!rearCameras.length) return null;
  const hits = rearCameras.filter((d) => isUltraLabel(d.label || ""));
  if (!hits.length) return null;
  // Prefer explicit ultra labels
  return hits[0];
}

export function pickTeleCamera(rearCameras = []) {
  if (!rearCameras.length) return null;
  const hits = rearCameras.filter((d) => isTeleLabel(d.label || ""));
  return hits[0] || null;
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
  const track = getActiveVideoTrack(stream);
  try {
    return track?.getCapabilities?.() || {};
  } catch {
    return {};
  }
}

export function getCurrentTrackSettings(stream) {
  const track = getActiveVideoTrack(stream);
  try {
    return track?.getSettings?.() || {};
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

/**
 * Stop all tracks on a stream (and optionally clear video element).
 */
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
  // Prefer high resolution when available; keep mobile-friendly max
  const preview = getCameraPreviewConstraints(base);
  return {
    ...preview,
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 1280, max: 1920 },
  };
}

/**
 * Start camera by deviceId. Prefers exact/ideal deviceId over facingMode
 * so multi-lens phones open the intended lens (main, not tele).
 */
export async function startCameraByDeviceId(deviceId, options = {}) {
  const {
    facingMode = "environment",
    highRes = true,
    preferDeviceId = true,
  } = options;

  const quality = highRes
    ? highResQuality(CONFIG?.app?.camera?.constraints?.default || {})
    : getCameraPreviewConstraints(
        CONFIG?.app?.camera?.constraints?.default || {},
      );

  const tryOpen = async (video) =>
    navigator.mediaDevices.getUserMedia({ video, audio: false });

  // Prefer deviceId first when we know the main/wide lens — avoids tele default
  if (preferDeviceId && deviceId) {
    try {
      return await tryOpen({
        deviceId: { exact: deviceId },
        ...quality,
      });
    } catch {
      try {
        return await tryOpen({
          deviceId: { ideal: deviceId },
          ...quality,
        });
      } catch {
        /* fall through */
      }
    }
  }

  // facingMode fallback
  try {
    return await tryOpen({
      facingMode: { exact: facingMode },
      ...quality,
    });
  } catch {
    try {
      return await tryOpen({
        facingMode: { ideal: facingMode },
        ...quality,
      });
    } catch {
      /* fall through */
    }
  }

  // Last resort
  if (deviceId) {
    try {
      return await tryOpen({
        deviceId: { ideal: deviceId },
        ...quality,
      });
    } catch {
      /* fall through */
    }
  }

  return tryOpen({
    facingMode: { ideal: facingMode },
    ...quality,
  });
}

/**
 * Apply digital / hardware zoom via applyConstraints.
 * @returns {Promise<number|false>} applied zoom or false
 */
export async function setCameraZoom(stream, value) {
  const track = getActiveVideoTrack(stream);
  if (!track) return false;
  const caps = getCurrentTrackCapabilities(stream);
  if (!caps?.zoom) return false;

  const min = caps.zoom.min ?? 1;
  const max = caps.zoom.max ?? 1;
  const next = Math.max(min, Math.min(Number(value) || 1, max));

  try {
    await track.applyConstraints({ advanced: [{ zoom: next }] });
    return next;
  } catch {
    try {
      await track.applyConstraints({ zoom: next });
      return next;
    } catch {
      return false;
    }
  }
}

/**
 * Compute which zoom modes are available for current devices + track.
 */
export function computeAvailableZoomModes(detected, stream) {
  const range = readZoomRange(stream);
  const modes = {
    "0.5x": false,
    "1x": true,
    "2x": false,
    max: false,
  };

  // 0.5x: ultra physical OR digital min < 1
  if (detected?.ultrawide?.deviceId) modes["0.5x"] = true;
  else if (range.supported && range.minZoom < 0.95) modes["0.5x"] = true;

  // 2x: tele physical OR digital max >= 2
  if (detected?.telephoto?.deviceId) modes["2x"] = true;
  else if (range.supported && range.maxZoom >= 1.8) modes["2x"] = true;

  // Max: only when hardware zoom range is meaningful
  if (range.supported && range.maxZoom > range.minZoom + 0.05) {
    modes.max = true;
  }

  return modes;
}

/**
 * Resolve target deviceId + digital zoom for a mode.
 * Never returns tele for "1x".
 *
 * @param {"0.5x"|"1x"|"2x"|"max"} mode
 * @param {{ detected, stream, facingMode }} ctx
 */
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
      digitalZoom: mode === "0.5x" && range.supported ? range.minZoom : 1,
      lensType: "unknown",
      mode: mode === "0.5x" ? "0.5x" : "1x",
    };
  }

  const m = String(mode || "1x").toLowerCase();

  if (m === "0.5x" || m === "0.5") {
    if (ultraId) {
      return {
        deviceId: ultraId,
        digitalZoom: 1,
        lensType: "ultrawide",
        mode: "0.5x",
      };
    }
    if (range.supported && range.minZoom < 0.95) {
      return {
        deviceId: mainId,
        digitalZoom: range.minZoom,
        lensType: "main",
        mode: "0.5x",
      };
    }
    return { deviceId: null, digitalZoom: null, lensType: null, mode: "0.5x", unavailable: true };
  }

  if (m === "2x" || m === "2") {
    // User selected 2x: use tele physical if exposed, else digital zoom 2 on main
    if (teleId) {
      return {
        deviceId: teleId,
        digitalZoom: 1,
        lensType: "telephoto",
        mode: "2x",
      };
    }
    if (range.supported && range.maxZoom >= 1.8) {
      return {
        deviceId: mainId,
        digitalZoom: Math.min(2, range.maxZoom),
        lensType: "main",
        mode: "2x",
      };
    }
    return { deviceId: null, digitalZoom: null, lensType: null, mode: "2x", unavailable: true };
  }

  if (m === "max") {
    if (range.supported && range.maxZoom > range.minZoom + 0.05) {
      return {
        deviceId: mainId,
        digitalZoom: range.maxZoom,
        lensType: "main",
        mode: "max",
      };
    }
    return { deviceId: null, digitalZoom: null, lensType: null, mode: "max", unavailable: true };
  }

  // 1x default — ALWAYS main wide
  return {
    deviceId: mainId,
    digitalZoom: range.supported ? Math.max(1, range.minZoom <= 1 ? 1 : range.minZoom) : 1,
    lensType: "main",
    mode: "1x",
  };
}

/**
 * After opening a stream, if 1x mode landed on ultra/tele, re-open main.
 */
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

  // Wrong lens (tele/ultra/macro) — stop and open main
  stopCurrentCamera(stream);
  try {
    return await startCameraByDeviceId(mainDeviceId, {
      facingMode: "environment",
      highRes: true,
      preferDeviceId: true,
    });
  } catch {
    // If main fails, try facingMode only once more
    try {
      return await startCameraByDeviceId(null, {
        facingMode: "environment",
        highRes: true,
        preferDeviceId: false,
      });
    } catch {
      return null;
    }
  }
}

/**
 * High-level: open rear main @ 1x.
 */
export async function resetToMainCameraX1(options = {}) {
  const { oldStream = null, videoEl = null } = options;

  if (oldStream) stopCurrentCamera(oldStream, videoEl);

  const devices = await ensureLabeledVideoDevices();
  const detected = detectRearCameras(devices);
  const main = detected.main || detected.rear[0] || null;
  const mainId = main?.deviceId || null;

  let stream = await startCameraByDeviceId(mainId, {
    facingMode: "environment",
    highRes: true,
    preferDeviceId: Boolean(mainId),
  });

  stream = await ensureMainCameraStream(stream, mainId, detected);
  if (!stream) throw new Error("Failed to open main rear camera");

  // Reset digital zoom to 1 if supported
  if (supportsHardwareZoom(stream)) {
    const range = readZoomRange(stream);
    const one = range.minZoom <= 1 && range.maxZoom >= 1 ? 1 : range.minZoom;
    await setCameraZoom(stream, one);
  }

  return {
    stream,
    detected,
    deviceId: getCurrentTrackSettings(stream).deviceId || mainId,
    lensType: "main",
    zoomMode: "1x",
    ...readZoomRange(stream),
    availableZoomModes: computeAvailableZoomModes(detected, stream),
  };
}

/**
 * Switch to a zoom mode. Stops old stream only when deviceId changes.
 *
 * @param {"0.5x"|"1x"|"2x"|"max"} mode
 * @param {{
 *   stream,
 *   videoEl,
 *   detected,
 *   facingMode,
 *   currentDeviceId,
 *   onNeedNewStream?: (deviceId) => Promise<MediaStream>,
 * }} ctx
 */
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

  const needOpenDevice =
    target.deviceId && (!stream || needSwitchDevice || !currentDeviceId);

  return {
    ok: true,
    mode: target.mode,
    deviceId: target.deviceId,
    digitalZoom: target.digitalZoom,
    lensType: target.lensType,
    needDeviceSwitch: Boolean(needOpenDevice || needSwitchDevice),
  };
}

/**
 * Full pipeline after permission: detect + pick main.
 * Compatible shape with older getAvailableCameras consumers.
 */
export async function detectAndClassifyCameras() {
  const devices = await ensureLabeledVideoDevices();
  const d = detectRearCameras(devices);
  return {
    allCameras: d.all,
    frontCameras: d.front,
    backCameras: d.rear,
    backNormalCamera: d.main,
    backUltraWideCamera: d.ultrawide,
    backZoomCamera: d.telephoto,
    // new shape
    detected: d,
  };
}

export function formatZoomModeLabel(mode) {
  if (mode === "max") return "Max";
  if (mode === "0.5x") return "0.5";
  if (mode === "1x") return "1x";
  if (mode === "2x") return "2x";
  return String(mode);
}
