/**
 * Camera lens selection + pinch zoom system.
 *
 * ## Universal classification (no model-specific tables)
 *
 * NEVER identify ultra-wide by zoom number alone.
 * The same phone may expose 0.5 / 0.6 / 0.7 / 0.8 / 0.9 / 1.0 / no zoom /
 * only deviceId / only labels — and values differ across Chrome, Samsung
 * Internet, Edge, Safari, and future browsers.
 *
 * Classification uses an ensemble of signals:
 *   labels · multi-rear structure · facingMode · optional capability probe
 *   (zoom range is only a WEAK supporting signal)
 *
 * Display factors (0.5x / 0.6x …) are read LIVE from getSettings/getCapabilities
 * AFTER the correct lens/stream is open — never used to guess the lens first.
 *
 * If confidence is low → ultrawide = null, needsManualLensPick = true,
 * rearOptions = every rear camera for user selection.
 *
 * Other rules:
 * - Default rear = main wide @ 1x (never telephoto / macro).
 * - Pinch: continuous min→max from live track.
 * - Stop old tracks only after the new stream is ready.
 * - Never hide a usable rear camera from candidate lists.
 */

import {
  getCameraPreviewConstraints,
  upgradeStreamQuality,
} from "./perfProfile";
import { CONFIG } from "@/config";
import {
  classifyCameras as classifyCamerasUniversal,
  extractTrackSignals,
  probeDeviceSignals,
  analyzeLensCandidate,
  confidenceFromAnalysis,
  hasNonZoomSignal,
  getBrowserCameraEnv,
  classifyLiveTrack,
  parseCamera2Index,
  isVirtualOrDesktopCamera,
} from "./cameraClassification";

// ─── Label matchers ───────────────────────────────────────────────

const FRONT_RE =
  /mặt\s*trước|front|user|trước|facing\s*front|selfie|camera2\s*1(?!\d)|camera1\s*1(?!\d)/;

// Mọi rear Samsung/Android: camera2 0/2/3… (không chỉ camera2 0 — S25 FE ultra = camera2 2)
const BACK_RE =
  /mặt\s*sau|back|rear|environment|sau|facing\s*back|outer|world|camera2\s*\d+|camera1\s*0/;

const AVOID_RE =
  /telephoto|\btele\b|\bzoom\b|macro|depth|portrait|periscope|chụp\s*xa|siêu\s*xa|bokeh|tof|time[\s-]?of[\s-]?flight|红外|ir\s*camera|monochrome/;

/**
 * Ultra-wide labels — multi-locale, multi-factor (0.5–0.9).
 * Does NOT assume ultra === 0.5x only.
 */
const ULTRA_RE =
  /cực\s*rộng|siêu\s*rộng|góc\s*siêu\s*rộng|góc\s*rộng|goc\s*rong|sieu\s*rong|ultra[\s_-]*wide|ultrawide|ultra\b|0\.[5-9]\s*x|\b0\.[5-9]\b|wide[\s_-]*angle|fisheye|fish[\s_-]*eye|\buw\b|cam[\s_-]*uw|uwcam|super[\s_-]*wide|extra[\s_-]*wide|uwb|camera2\s*2(?!\d)|samsung[\s_-]*camera[\s_-]*2|cam[_\s-]*2(?!\d)|lens[_\s-]*2(?!\d)|secondary|aux(iliary)?|超广角|超廣角|广角|초광각|광각|超広角|広角|grand[\s_-]*angle|angolo[\s_-]*ultra|ultrawinkel|ultra[\s_-]*weit/;

/**
 * Strong ultra label — text/identity only.
 * MUST NOT include bare 0.5x–0.9x numbers (those are display values, not IDs).
 */
const CONFIDENT_ULTRA_RE =
  /ultra[\s_-]*wide|ultrawide|siêu\s*rộng|cực\s*rộng|góc\s*siêu\s*rộng|fisheye|fish[\s_-]*eye|super[\s_-]*wide|extra[\s_-]*wide|\buw\b|超广角|超廣角|초광각|超広角|grand[\s_-]*angle/;

/** Weak: zoom-like text in label — supporting only, never sufficient alone */
const ZOOM_IN_LABEL_RE = /0\.[5-9]\s*x|\b0\.[5-9]\b/;

const TELE_RE =
  /chụp\s*xa|telephoto|\btele\b|periscope|\b2x\b|\b3x\b|\b5x\b|\b10x\b|camera2\s*[3-9]|cam[_\s-]*3|lens[_\s-]*3|长焦|長焦|망원|望遠/;

/**
 * Live zoom band used only for DISPLAY / digital wide apply after stream is open.
 * NEVER use this alone to decide which deviceId is ultra-wide.
 */
const ULTRA_ZOOM_MIN = 0.15;
const ULTRA_ZOOM_MAX = 0.95;

/** Signals that are NOT zoom-number based (required for auto-pick) */
const NON_ZOOM_SIGNALS = new Set([
  "confident_label",
  "ultra_label",
  "multi_rear",
  "not_main",
  "not_tele",
  "index_hint",
  "secondary_hint",
  "camera2_ultra_index",
  "android_aux_rear",
]);

/**
 * Chỉ số zoom CHỈ lấy từ camera thật (getCapabilities / getSettings),
 * KHÔNG đoán theo hãng (tránh máy 0.5 hiện nhầm 0.6).
 */
function getUserAgent() {
  try {
    return String(navigator.userAgent || navigator.vendor || "");
  } catch {
    return "";
  }
}

export function isSamsungDevice() {
  return /samsung|sm-|galaxy/i.test(getUserAgent());
}

/**
 * @deprecated Không dùng cho UI label — chỉ fallback kỹ thuật hiếm.
 * UI phải dùng resolveUltraWideFactor(stream) từ cam thật.
 */
export function defaultUltraFactor() {
  return null;
}

/** Làm tròn 1 chữ số từ giá trị camera thật (0.5 / 0.6 / 0.7 / 0.8 / 0.9…) */
export function roundZoomFactor(z) {
  const n = Number(z);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Snap gần mốc phổ biến nếu lệch float — mọi hệ số góc rộng
  const snaps = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5, 2, 3, 5, 10];
  for (const s of snaps) {
    if (Math.abs(n - s) < 0.05) return s;
  }
  return Math.round(n * 10) / 10;
}

/** True if zoom value is in ultra-wide band (any manufacturer factor). */
export function isUltraZoomValue(z) {
  const n = Number(z);
  return Number.isFinite(n) && n > ULTRA_ZOOM_MIN && n < ULTRA_ZOOM_MAX;
}

/** Label confidently says ultra-wide (not weak camera2-2 / secondary only). */
export function isConfidentUltraLabel(label = "") {
  return CONFIDENT_ULTRA_RE.test(String(label || "").toLowerCase());
}

// ─── Capability probe cache (session) ─────────────────────────────
/** @type {Map<string, { minZoom: number|null, maxZoom: number|null, facingMode: string|null, width: number|null, height: number|null, probedAt: number }>} */
const deviceProbeCache = new Map();
let probeInFlight = null;

// A browser does not expose a standard "lens type" field. When a user picks
// the visibly widest rear camera once, remember that exact per-origin
// deviceId and prefer it on later UW taps. Device ids can rotate after site
// data/permission is cleared, so every read is validated against the current
// enumerateDevices result.
const PREFERRED_WIDE_CAMERA_KEY =
  "huy-locket:camera:preferred-wide-device:v1";

export function getPreferredWideCameraId(rearDevices = []) {
  try {
    const id = globalThis?.localStorage?.getItem(PREFERRED_WIDE_CAMERA_KEY);
    if (!id) return null;
    // No list yet — return stored id without wiping (caller validates later)
    if (!Array.isArray(rearDevices) || rearDevices.length === 0) return id;
    const valid = rearDevices.some((device) => device?.deviceId === id);
    if (valid) return id;
    // Id rotated after permission/site-data clear
    globalThis?.localStorage?.removeItem(PREFERRED_WIDE_CAMERA_KEY);
  } catch {
    /* localStorage may be blocked in private/embedded browsing */
  }
  return null;
}

export function rememberPreferredWideCameraId(deviceId) {
  if (!deviceId) return false;
  try {
    globalThis?.localStorage?.setItem(
      PREFERRED_WIDE_CAMERA_KEY,
      String(deviceId),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Exact copy for UI when Chrome only exposes one rear + zoom.min ≥ 1.
 * Do not claim “không hỗ trợ 0.5x” — that is the wrong failure mode.
 */
export const BROWSER_HIDES_ULTRAWIDE_MSG =
  "Chrome chưa cung cấp ống kính siêu rộng của thiết bị này cho website. Hãy thử Samsung Internet/Chrome mới nhất hoặc chọn camera trong danh sách ống kính.";

/** Last sequential rear probe rows (for ?cameraDebug=1). No photos / PII beyond labels. */
let lastRearProbeReport = [];

export function getLastRearProbeReport() {
  return Array.isArray(lastRearProbeReport) ? lastRearProbeReport.slice() : [];
}

export function isCameraDebugEnabled() {
  try {
    if (typeof window === "undefined") return false;
    return (
      new URLSearchParams(window.location.search || "").get("cameraDebug") ===
      "1"
    );
  } catch {
    return false;
  }
}

/**
 * Snapshot one live track for logs / debug table.
 * Does NOT read focalLength (W3C proposal only — not stable in browsers).
 * @param {MediaStream|null} stream
 * @param {MediaDeviceInfo|null} [deviceInfo]
 */
export function snapshotTrackCameraInfo(stream, deviceInfo = null) {
  const track = getActiveVideoTrack(stream);
  let caps = {};
  let settings = {};
  try {
    caps = track?.getCapabilities?.() || {};
  } catch {
    caps = {};
  }
  try {
    settings = track?.getSettings?.() || {};
  } catch {
    settings = {};
  }
  const zoomParsed = parseZoomCapability(caps.zoom);
  return {
    label: deviceInfo?.label || track?.label || "",
    deviceId: settings.deviceId || deviceInfo?.deviceId || null,
    groupId: deviceInfo?.groupId || null,
    capabilitiesZoom: zoomParsed
      ? { min: zoomParsed.min, max: zoomParsed.max, step: zoomParsed.step }
      : caps.zoom && typeof caps.zoom === "object"
        ? { empty: true }
        : null,
    settingsZoom:
      typeof settings.zoom === "number" && Number.isFinite(settings.zoom)
        ? settings.zoom
        : null,
    width: settings.width ?? null,
    height: settings.height ?? null,
    facingMode: settings.facingMode || null,
    trackState: track?.readyState || null,
    // Explicit: never depend on focalLength (W3C issue #20 — not shipped stably)
    focalLengthUsed: false,
  };
}

/**
 * All rear videoinputs after permission + enumerateDevices.
 * Never drop a rear camera only because label lacks "0.5" / "ultra" / "wide".
 * (W3C: multi-rear has no standard focalLength API yet — labels are unreliable.)
 * @returns {Promise<MediaDeviceInfo[]>}
 */
export async function listAllRearVideoInputs() {
  // 1) Permission first so labels + deviceIds are populated
  const devices = await ensureLabeledVideoDevices();
  const classified = detectRearCameras(devices);
  let rear = Array.isArray(classified.rear) ? classified.rear.slice() : [];

  // Safety: any non-front, non-virtual videoinput must remain selectable
  const rearIds = new Set(rear.map((d) => d?.deviceId).filter(Boolean));
  for (const d of devices) {
    if (!d?.deviceId || d.kind !== "videoinput") continue;
    if (rearIds.has(d.deviceId)) continue;
    const label = d.label || "";
    if (isFrontLabel(label)) continue;
    if (isVirtualOrDesktopCamera(label)) continue;
    // Unlabeled after permission often = rear on Android — keep it
    rear.push(d);
    rearIds.add(d.deviceId);
  }
  return rear;
}

/** Clear probe cache (call with invalidateCameraCache). */
export function clearDeviceProbeCache() {
  deviceProbeCache.clear();
  probeInFlight = null;
}

/**
 * Low-res probe — full signal bag (zoom, facing, resolution, FOV/focal if any).
 * Cached; never blocks UI longer than ~2.5s per device.
 * @param {string} deviceId
 * @param {MediaDeviceInfo|null} [deviceInfo]
 */
export async function probeDeviceCapabilities(deviceId, deviceInfo = null) {
  if (!deviceId || !navigator.mediaDevices?.getUserMedia) return null;
  if (deviceProbeCache.has(deviceId)) return deviceProbeCache.get(deviceId);

  const meta = await probeDeviceSignals(deviceId, deviceInfo);
  // A busy Samsung camera often reports a temporary probe failure while the
  // preview owns the hardware. Do not make that transient failure permanent
  // for the rest of the session.
  if (meta && !meta.failed) deviceProbeCache.set(deviceId, meta);
  return meta;
}

/**
 * Score + signal breakdown for ultra-wide candidate.
 * Zoom numbers are WEAK supporting evidence only — never sufficient alone.
 * Never brand-specific / never fixed 0.5 assumption.
 *
 * @returns {{ score: number, signals: string[] }}
 */
export function analyzeUltraWideCandidate(
  device,
  {
    mainId = null,
    teleId = null,
    rearIndex = 0,
    rearTotal = 1,
    probe = null,
  } = {},
) {
  if (!device?.deviceId) return { score: -999, signals: [] };
  if (device.deviceId === mainId) {
    return { score: -200, signals: ["is_main"] };
  }
  if (device.deviceId === teleId) {
    return { score: -150, signals: ["is_tele"] };
  }

  const label = String(device.label || "").toLowerCase();
  let score = 0;
  const signals = [];

  // ── Primary: identity labels (not zoom numbers) ──
  if (isConfidentUltraLabel(label)) {
    score += 120;
    signals.push("confident_label");
  } else if (isUltraLabel(label) && !ZOOM_IN_LABEL_RE.test(label)) {
    // ultra_label without pure-number match
    score += 70;
    signals.push("ultra_label");
  } else if (isUltraLabel(label) && ZOOM_IN_LABEL_RE.test(label)) {
    // Label is only/mostly a zoom number like "0.6x" — weak
    score += 20;
    signals.push("zoom_in_label");
  }

  if (isTeleLabel(label) || AVOID_RE.test(label)) {
    score -= 120;
    signals.push("tele_or_avoid");
  }
  if (/macro|depth|portrait|tof|bokeh|infrared|ir\b|mono/.test(label)) {
    score -= 80;
    signals.push("macro_depth");
  }

  // Bare 0.x in label (supporting only)
  if (ZOOM_IN_LABEL_RE.test(label) && !signals.includes("zoom_in_label")) {
    score += 12;
    signals.push("zoom_in_label");
  }

  // Secondary device hints (camera2 2, aux, secondary) — structure, not zoom
  if (
    /camera2\s*2(?!\d)|cam[_\s-]*2(?!\d)|lens[_\s-]*2(?!\d)|secondary|aux(iliary)?/.test(
      label,
    )
  ) {
    score += 25;
    signals.push("secondary_hint");
  }

  // Android camera2 index 2 = ultra-wide (S25 FE / multi-lens Android)
  const camIdx = parseCamera2Index(label);
  if (camIdx === 2 && rearTotal >= 2) {
    score += 55;
    signals.push("camera2_ultra_index", "secondary_hint", "android_aux_rear");
  } else if (camIdx != null && camIdx >= 3 && rearTotal >= 2) {
    score -= 35;
  } else if (
    camIdx != null &&
    camIdx !== 0 &&
    camIdx !== 1 &&
    rearTotal >= 2 &&
    device.deviceId !== mainId
  ) {
    score += 20;
    signals.push("android_aux_rear");
  }

  // ── Weak: capability probe zoom (NEVER sole auto-pick) ──
  const minZ = probe?.minZoom;
  if (typeof minZ === "number" && Number.isFinite(minZ)) {
    if (isUltraZoomValue(minZ)) {
      // Small weight only — browsers disagree on the number
      score += 22;
      signals.push("min_zoom_lt_1");
    } else if (minZ >= 0.95 && minZ <= 1.05) {
      score -= 25;
      signals.push("min_zoom_mainish");
    } else if (minZ > 1.2) {
      score -= 100;
      signals.push("min_zoom_teleish");
    }
  }

  if (probe?.facingMode === "user") {
    score -= 200;
    signals.push("facing_user");
  } else if (probe?.facingMode === "environment") {
    score += 5;
    signals.push("facing_env");
  }

  // Multi-rear structure (not zoom)
  if (rearTotal >= 2) {
    score += 18;
    signals.push("multi_rear");
    signals.push("not_main");
    if (device.deviceId !== teleId) signals.push("not_tele");
  }

  // Weak index hint only with multi-rear (never sole)
  if (rearTotal >= 2 && rearIndex === 0 && !isTeleLabel(label)) {
    score += 6;
    signals.push("index_hint");
  }
  if (rearTotal >= 3 && rearIndex === rearTotal - 1 && isTeleLabel(label)) {
    score -= 20;
  }

  return { score, signals };
}

/**
 * @deprecated Prefer analyzeUltraWideCandidate — kept for call-site compatibility.
 */
export function scoreUltraWideCandidate(device, opts = {}) {
  return analyzeUltraWideCandidate(device, opts).score;
}

/**
 * Confidence for auto-selecting a device as ultra-wide.
 * Zoom-only evidence → always "low" (manual pick recommended).
 *
 * @returns {"high"|"medium"|"low"|"none"}
 */
export function ultraWideConfidenceFromAnalysis({ score = 0, signals = [] } = {}) {
  const nonZoom = signals.filter((s) => NON_ZOOM_SIGNALS.has(s));
  const hasConfidentLabel = signals.includes("confident_label");
  const hasUltraLabel = signals.includes("ultra_label");
  const hasStructure =
    signals.includes("multi_rear") || signals.includes("secondary_hint");

  if (score <= 0) return "none";

  // High: clear text identity
  if (hasConfidentLabel && score >= 80) return "high";
  if (hasUltraLabel && hasStructure && score >= 60) return "high";
  if (signals.includes("camera2_ultra_index") && score >= 50) return "high";

  // Medium: label or multi-rear structure with supporting evidence
  if (nonZoom.length >= 2 && score >= 40) return "medium";
  if ((hasUltraLabel || hasStructure) && score >= 50) return "medium";
  if (signals.includes("android_aux_rear") && score >= 35) return "medium";

  // Low: zoom-only or single weak signal — do NOT trust as THE ultra lens
  if (score > 0) return "low";
  return "none";
}

/** True if analysis has at least one non-zoom identity/structure signal */
export function hasNonZoomUltraSignal(signals = []) {
  return signals.some((s) => NON_ZOOM_SIGNALS.has(s));
}

/**
 * Đọc hệ số zoom góc rộng TỪ STREAM CAMERA.
 * Thứ tự: applied → settings.zoom → capabilities.zoom.min
 * null = chưa đọc được (chưa mở cam / cam không expose zoom API).
 *
 * @param {MediaStream|null} stream
 * @param {object|null} _detected — giữ signature; không dùng đoán hãng
 * @param {number|null} appliedZoom — zoom vừa applyConstraints thành công
 */
export function resolveUltraWideFactor(
  stream = null,
  _detected = null,
  appliedZoom = null,
) {
  // 1) Zoom vừa apply (sau applyConstraints) — any 0.5–0.9 band
  const applied = Number(appliedZoom);
  if (isUltraZoomValue(applied)) {
    return roundZoomFactor(applied);
  }

  if (!stream) return null;

  // 2) getSettings().zoom — giá trị đang chạy
  try {
    const settingsZ = getCurrentTrackSettings(stream)?.zoom;
    if (isUltraZoomValue(settingsZ)) {
      return roundZoomFactor(settingsZ);
    }
  } catch {
    /* ignore */
  }

  // 3) getCapabilities().zoom.min — dải zoom HW/logical multi-cam
  try {
    const range = readZoomRange(stream);
    if (range.supported && isUltraZoomValue(range.minZoom)) {
      return roundZoomFactor(range.minZoom);
    }
  } catch {
    /* ignore */
  }

  // Không đoán hãng — chờ mở cam / apply xong mới có số
  return null;
}

/**
 * Đọc min/max zoom thật từ stream (capabilities).
 * Dùng cho UI + pinch.
 */
export function readLiveZoomFromCamera(stream) {
  if (!stream) {
    return { min: null, max: null, current: null, supported: false };
  }
  const range = readZoomRange(stream);
  let current = null;
  try {
    const z = getCurrentTrackSettings(stream)?.zoom;
    if (typeof z === "number" && Number.isFinite(z)) current = z;
  } catch {
    /* ignore */
  }
  return {
    min: range.supported ? range.minZoom : null,
    max: range.supported ? range.maxZoom : null,
    current,
    supported: Boolean(range.supported),
  };
}

// ─── Live zoom API (no hard-coded 0.5 / 0.6 factors) ─────────────
//
// Reality: OEMs expose ultra-wide as different native zooms (0.5 / 0.6 / 0.7…).
// The ONLY source of truth for continuous zoom is:
//   track.getCapabilities().zoom  →  clamp  →  track.applyConstraints
//
// Internal UI mode key "0.5x" is a legacy *label slot* for "widest FOV",
// NOT a numeric zoom target. Display text comes from live min / settings.

/** Legacy preset key = "go widest" (UI / state). Not a zoom number. */
export const WIDE_ZOOM_MODE = "0.5x";

const WIDE_MODE_ALIASES = new Set([
  "0.5x",
  "0.5",
  "0.6x",
  "0.6",
  "0.7x",
  "0.7",
  "0.8x",
  "0.8",
  "0.9x",
  "0.9",
  "uw",
  "wide",
  "ultrawide",
  "siêu rộng",
  "sieu rong",
]);

/** True if mode means "use widest FOV / ultra lens", not a fixed 0.5 factor. */
export function isWideZoomMode(mode) {
  return WIDE_MODE_ALIASES.has(String(mode || "").toLowerCase().trim());
}

/**
 * Pinch / badge threshold between "wide" and "main" display bands.
 * Derived from live ultra factor or capabilities.zoom.min — never hard-coded 0.5.
 *
 * @param {MediaStream|null} stream
 * @param {number|null} [ultraFactor]
 * @returns {number}
 */
export function wideBandThreshold(stream = null, ultraFactor = null) {
  const uf = Number(ultraFactor);
  if (Number.isFinite(uf) && uf > 0.15 && uf < 0.98) {
    return Math.min(0.98, (uf + 1) / 2);
  }
  const live = readLiveZoomFromCamera(stream);
  if (live.supported && live.min != null && live.min < 0.98) {
    return Math.min(0.98, (Number(live.min) + 1) / 2);
  }
  // Soft fallback when caps unknown (structural multi-lens only)
  return 0.92;
}

/**
 * Clamp desired zoom to **this track's** getCapabilities().zoom and apply.
 * Never restarts stream / never changes deviceId.
 *
 * @param {MediaStream|null} stream
 * @param {number} desiredZoom
 * @returns {Promise<number|false>}
 */
/**
 * @param {MediaStream|null} stream
 * @param {number} desiredZoom
 * @param {{ fast?: boolean, forceCaps?: boolean }} [options]
 */
export async function applyLiveZoom(stream, desiredZoom, options = {}) {
  if (!stream || !supportsHardwareZoom(stream)) return false;
  // Do NOT clearTrackZoomCache on every pinch frame — that forces getCapabilities
  // and multi-format applyConstraints (major Android lag source).
  if (options.forceCaps) clearTrackZoomCache(stream);
  const range = readZoomRange(stream);
  if (!range.supported) return false;
  const target = clampZoom(desiredZoom, range.minZoom, range.maxZoom);
  return setCameraZoom(stream, target, {
    fast: options.fast === true,
    forceCaps: options.forceCaps === true,
  });
}

/**
 * Pinch-only path: one applyConstraints, cached caps/style, no getSettings.
 * Does not call readZoomRange/supportsHardwareZoom every frame.
 * Prefer createLatestZoomApplier for continuous gestures.
 * @returns {Promise<number|false>}
 */
export async function applyPinchZoom(stream, desiredZoom) {
  return setCameraZoom(stream, desiredZoom, {
    fast: true,
    continuous: true,
  });
}

/**
 * Structured PTZ logs — no photos / PII. W3C-aligned diagnostic shape.
 * @param {Record<string, unknown>} payload
 */
export function logCameraPtz(payload = {}) {
  try {
    let visibilityState = null;
    try {
      visibilityState =
        typeof document !== "undefined" ? document.visibilityState : null;
    } catch {
      /* ignore */
    }
    console.info("[camera-ptz]", {
      visibilityState,
      ...payload,
    });
  } catch {
    /* ignore */
  }
}

/**
 * @param {MediaStream|null|undefined} stream
 * @returns {boolean}
 */
export function isLiveVideoStream(stream) {
  const track = getActiveVideoTrack(stream);
  return Boolean(track && track.readyState === "live");
}

/**
 * Wait until page is visible (PTZ applyConstraints requires visibility).
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export function waitForPageVisible(timeoutMs = 8000) {
  if (isPageVisibleForPtz()) return Promise.resolve(true);
  if (typeof document === "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      try {
        document.removeEventListener("visibilitychange", onVis);
      } catch {
        /* ignore */
      }
      clearTimeout(timer);
      resolve(ok);
    };
    const onVis = () => {
      if (isPageVisibleForPtz()) finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    document.addEventListener("visibilitychange", onVis);
  });
}

/**
 * Park current track at capabilities.zoom.min (widest FOV this track reports).
 * W3C: apply only when page visible; success only if live + actual settings near target.
 * Note: standard min is often 1 — callers must not treat min≥0.98 as ultra-wide.
 *
 * @param {MediaStream|null} stream
 * @returns {Promise<number|null>} applied zoom or null
 */
export async function parkAtWidestTrackZoom(stream) {
  if (!stream || !isLiveVideoStream(stream)) return null;
  const range = readZoomRange(stream);
  if (!range.supported) {
    logCameraPtz({
      path: "logical-zoom",
      applyResult: "no-zoom-caps",
      trackState: getActiveVideoTrack(stream)?.readyState || null,
      zoomCapabilities: null,
    });
    return null;
  }
  if (!isPageVisibleForPtz()) {
    const ok = await waitForPageVisible(8000);
    if (!ok) {
      logCameraPtz({
        path: "logical-zoom",
        applyResult: "page-not-visible",
        requestedZoom: range.minZoom,
        trackState: getActiveVideoTrack(stream)?.readyState || null,
      });
      return null;
    }
  }
  clearTrackZoomCache(stream);
  const target = Number(range.minZoom);
  const before = getCurrentTrackSettings(stream)?.zoom ?? null;
  const applied = await setCameraZoom(stream, target);
  // Brief settle so getSettings reflects the constraint (Samsung HAL)
  await new Promise((r) => setTimeout(r, 80));
  const track = getActiveVideoTrack(stream);
  const after = getCurrentTrackSettings(stream)?.zoom ?? null;
  const live = Boolean(track && track.readyState === "live");
  const closeEnough =
    typeof after === "number" &&
    Number.isFinite(after) &&
    Math.abs(after - target) <= Math.max(0.15, (range.zoomStep || 0.1) * 2);
  logCameraPtz({
    path: "logical-zoom",
    zoomCapabilities: {
      min: range.minZoom,
      max: range.maxZoom,
      step: range.zoomStep,
    },
    zoomBefore: before,
    requestedZoom: target,
    zoomAfter: after,
    selectedDeviceId: getCurrentTrackSettings(stream)?.deviceId || null,
    trackState: track?.readyState || null,
    applyResult:
      applied === false || !live
        ? "failed"
        : closeEnough
          ? after
          : typeof after === "number"
            ? after
            : applied,
  });
  if (applied === false || !live) return null;
  // Prefer measured settings; fall back to applied when UA omits settings.zoom
  if (typeof after === "number" && Number.isFinite(after)) return after;
  return typeof applied === "number" ? applied : target;
}

/**
 * Score how "wide" a live stream is (lower = wider FOV).
 * Uses capabilities.zoom.min, then settings.zoom.
 * @param {MediaStream|null} stream
 * @returns {number} score (Infinity if unknown)
 */
export function widestScoreFromStream(stream) {
  const range = readZoomRange(stream);
  if (range.supported && Number.isFinite(range.minZoom)) {
    return range.minZoom;
  }
  const z = getCurrentTrackSettings(stream)?.zoom;
  if (typeof z === "number" && Number.isFinite(z)) return z;
  return Number.POSITIVE_INFINITY;
}

const MAIN_HINT_RE =
  /\b1x\b|main|primary|standard|bình\s*thường|camera\s*kép|\bwide\b(?!\s*angle)|default|rear\s*camera|back\s*camera/;

const PREFER_RE =
  /back\s*camera|rear\s*camera|\bwide\b(?!\s*angle)|main|environment|primary|standard/;

/** Preset buttons — bật theo máy (ultra / tele) */
export const ZOOM_PRESETS = ["0.5x", "1x", "2x", "3x"];
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
 * Fast by default (labels + multi-rear heuristics).
 * Pass `{ probe: true }` to await capability probes (slower, more accurate).
 * Prefer background probe via scheduleCameraCapabilityProbe / switchToUltra.
 * @param {{ probe?: boolean }} [opts]
 */
export async function detectCameraDevices(opts = {}) {
  const devices = await ensureLabeledVideoDevices();
  let result = detectRearCameras(devices);
  // Only block when explicitly requested — keeps camera open fast
  if (opts.probe === true) {
    try {
      result = await enrichDetectedWithCapabilityProbes(result);
    } catch (e) {
      console.warn("[camera] capability probe skipped:", e?.message);
    }
  }
  return result;
}

/**
 * Fire-and-forget capability probes. Opening probe streams is only safe while
 * no preview/lens switch owns the camera, so callers must opt in explicitly.
 */
export function scheduleCameraCapabilityProbe(detected, options = {}) {
  if (options.cameraIdle !== true) return;
  if (!detected?.rear || detected.rear.length < 2) return;
  if (isConfidentUltraLabel(detected.ultrawide?.label || "")) return;
  // Don't await. The caller has confirmed that no live stream is active.
  Promise.resolve()
    .then(() => enrichDetectedWithCapabilityProbes(detected))
    .catch(() => {});
}

export function detectRearCameras(videoDevices = []) {
  // Universal engine — labels + structure + probe cache (when warm)
  const classified = classifyCamerasUniversal(videoDevices, deviceProbeCache);
  return {
    all: classified.all,
    front: classified.front,
    rear: classified.rear,
    main: classified.main,
    ultrawide: classified.ultrawide,
    telephoto: classified.telephoto,
    rearOptions: classified.rearOptions,
    ultraConfidence: classified.ultraConfidence,
    needsManualLensPick: classified.needsManualLensPick,
    ultraRanked: classified.ultraRanked,
    browser: classified.browser || getBrowserCameraEnv(),
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
 * Ultra-wide picker — ensemble only; NEVER zoom-number alone.
 *
 * Auto-returns a device only at high/medium confidence with ≥1 non-zoom signal.
 * Low confidence → null (caller should expose rearOptions for manual pick).
 *
 * Pass `{ allowLowConfidence: true }` only for candidate lists / trial open.
 */
export function pickUltraWideCamera(
  rearCameras = [],
  mainCamera = null,
  teleCamera = null,
  opts = {},
) {
  const { allowLowConfidence = false } = opts;
  if (!rearCameras.length) return null;

  const mainId =
    mainCamera?.deviceId || pickMainRearCamera(rearCameras)?.deviceId;
  const teleId =
    teleCamera?.deviceId ||
    rearCameras.find((d) => isTeleLabel(d.label || ""))?.deviceId ||
    null;

  // 1) Confident text identity (not a bare zoom number)
  const confident = rearCameras.find((d) =>
    isConfidentUltraLabel(d.label || ""),
  );
  if (confident) return confident;

  // 2) Android camera2 index 2 = ultra-wide (Samsung S25 FE, Pixel, …)
  //    Structural index from enumerateDevices — not a zoom number guess.
  const byCamera2 = rearCameras.find((d) => {
    if (!d?.deviceId || d.deviceId === mainId || d.deviceId === teleId)
      return false;
    return parseCamera2Index(d.label || "") === 2;
  });
  if (byCamera2) return byCamera2;

  // 3) Ultra label that is more than just "0.6x" text
  const byLabel = rearCameras.find((d) => {
    const l = d.label || "";
    if (!isUltraLabel(l)) return false;
    // Reject if the ONLY ultra match is a zoom number in the label
    const stripped = String(l)
      .toLowerCase()
      .replace(ZOOM_IN_LABEL_RE, "")
      .replace(/\s+/g, "");
    return isUltraLabel(l) && (stripped.length > 2 || isConfidentUltraLabel(l));
  });
  // Prefer label that still has identity words after stripping zoom tokens
  const byStrongLabel = rearCameras.find((d) => {
    const l = String(d.label || "").toLowerCase();
    if (!isUltraLabel(l)) return false;
    return (
      isConfidentUltraLabel(l) ||
      /ultra|wide|rộng|广角|광각|fisheye|uw|aux|secondary|camera2/.test(l)
    );
  });
  if (byStrongLabel) return byStrongLabel;
  if (byLabel && isConfidentUltraLabel(byLabel.label || "")) return byLabel;

  // 4) Ensemble score — require non-zoom signal for auto-pick
  const scored = rearCameras
    .map((device, rearIndex) => {
      const probe = deviceProbeCache.get(device.deviceId) || null;
      const analysis = analyzeUltraWideCandidate(device, {
        mainId,
        teleId,
        rearIndex,
        rearTotal: rearCameras.length,
        probe,
      });
      let score = analysis.score;
      if (parseCamera2Index(device.label || "") === 2) score += 80;
      return {
        device,
        ...analysis,
        score,
        confidence: ultraWideConfidenceFromAnalysis({
          ...analysis,
          score,
          signals: [
            ...analysis.signals,
            ...(parseCamera2Index(device.label || "") === 2
              ? ["camera2_ultra_index", "secondary_hint"]
              : []),
          ],
        }),
      };
    })
    .filter((s) => s.device.deviceId !== mainId)
    .filter((s) => s.device.deviceId !== teleId)
    .filter((s) => !isTeleLabel(s.device.label || ""))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;

  if (best.confidence === "high" || best.confidence === "medium") {
    // Guard: zoom-only must never win auto-pick
    if (hasNonZoomUltraSignal(best.signals)) return best.device;
    if (parseCamera2Index(best.device.label || "") === 2) return best.device;
  }

  if (allowLowConfidence && best.score > 0) {
    return best.device;
  }

  // Low / zoom-only / uncertain → no auto ultra device
  return null;
}

/**
 * Full analysis of ultra classification for UI (manual pick when needed).
 */
export function classifyUltraWideState(
  rearCameras = [],
  mainCamera = null,
  teleCamera = null,
) {
  const mainId =
    mainCamera?.deviceId || pickMainRearCamera(rearCameras)?.deviceId;
  const teleId =
    teleCamera?.deviceId ||
    rearCameras.find((d) => isTeleLabel(d.label || ""))?.deviceId ||
    null;

  const ranked = rearCameras
    .filter((d) => d?.deviceId)
    .map((device, rearIndex) => {
      const probe = deviceProbeCache.get(device.deviceId) || null;
      const analysis = analyzeUltraWideCandidate(device, {
        mainId,
        teleId,
        rearIndex,
        rearTotal: rearCameras.length,
        probe,
      });
      return {
        device,
        deviceId: device.deviceId,
        label: device.label || "",
        ...analysis,
        confidence: ultraWideConfidenceFromAnalysis(analysis),
      };
    })
    .sort((a, b) => b.score - a.score);

  const auto = pickUltraWideCamera(rearCameras, mainCamera, teleCamera);
  const best = ranked.find((r) => r.deviceId === auto?.deviceId) || ranked[0];
  const confidence = auto
    ? best?.confidence || "medium"
    : ranked.some((r) => r.score > 0)
      ? "low"
      : "none";

  return {
    ultrawide: auto,
    confidence,
    /** User must pick when we cannot trust auto classification */
    needsManualLensPick:
      !auto && rearCameras.length >= 2 && confidence !== "high",
    ranked,
    rearOptions: rearCameras.slice(),
  };
}

/**
 * Danh sách deviceId ứng viên ultra (thử lần lượt khi mở UW).
 * Heuristic chỉ sắp xếp — KHÔNG loại bỏ vĩnh viễn tele/macro/depth đoán sai.
 * Mọi rear public (trừ main) đều có trong list thử + manual picker.
 */
export function listUltraWideCandidates(
  rearCameras = [],
  mainCamera = null,
  teleCamera = null,
) {
  const mainId =
    mainCamera?.deviceId || pickMainRearCamera(rearCameras)?.deviceId;
  const teleId =
    teleCamera?.deviceId ||
    rearCameras.find((d) => isTeleLabel(d.label || ""))?.deviceId ||
    null;

  const scored = rearCameras
    .filter((d) => d?.deviceId)
    .filter((d) => d.deviceId !== mainId)
    .map((device) => {
      let score = scoreUltraWideCandidate(device, {
        mainId,
        teleId,
        rearIndex: rearCameras.findIndex((x) => x.deviceId === device.deviceId),
        rearTotal: rearCameras.length,
        probe: deviceProbeCache.get(device.deviceId) || null,
      });
      // Samsung / Android camera2 2 = often ultra (S25 FE, A-series, …)
      const idx = parseCamera2Index(device.label || "");
      if (idx === 2) score += 80;
      else if (idx != null && idx > 2) score -= 10;
      // Tele-looking labels sort later — still keep them reachable
      if (device.deviceId === teleId || isTeleLabel(device.label || "")) {
        score -= 40;
      }
      return { device, score };
    })
    .sort((a, b) => b.score - a.score);

  const ids = scored.map((s) => s.device.deviceId);

  // Prefer confident auto pick / camera2-2 first
  const primary = pickUltraWideCamera(rearCameras, mainCamera, teleCamera);
  const cam2Ultra = rearCameras.find(
    (d) =>
      d?.deviceId &&
      d.deviceId !== mainId &&
      parseCamera2Index(d.label || "") === 2,
  );
  const head = [primary?.deviceId, cam2Ultra?.deviceId].filter(Boolean);
  const ordered = [];
  for (const id of head) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  for (const id of ids) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  // Safety: every non-main rear must appear
  for (const d of rearCameras) {
    const id = d?.deviceId;
    if (id && id !== mainId && !ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

/**
 * Optional one-shot capability probes for multi-rear phones without
 * confident ultra labels. Cached — does not re-open cameras next time.
 * @param {ReturnType<typeof detectRearCameras>} detected
 */
export async function enrichDetectedWithCapabilityProbes(detected) {
  if (!detected?.rear?.length || detected.rear.length < 2) return detected;

  const ultraLabelOk = isConfidentUltraLabel(detected.ultrawide?.label || "");
  if (ultraLabelOk) return detected;

  // Probe rear devices missing from cache (max 4 to keep startup reasonable)
  const toProbe = detected.rear
    .map((d) => d.deviceId)
    .filter(Boolean)
    .filter((id) => !deviceProbeCache.has(id))
    .slice(0, 4);

  if (toProbe.length) {
    // Deduplicate enrich calls and probe one camera at a time. Promise.all here
    // races multiple getUserMedia calls for Samsung's single camera slot.
    if (!probeInFlight) {
      probeInFlight = (async () => {
        for (const id of toProbe) {
          await probeDeviceCapabilities(id);
        }
      })().finally(() => {
        probeInFlight = null;
      });
    }
    try {
      await probeInFlight;
    } catch {
      /* ignore */
    }
  }

  // Re-classify — probe zoom only supports labels/structure, never sole promote
  const main = detected.main || pickMainRearCamera(detected.rear);
  const telephoto = pickTeleCamera(detected.rear, main);
  const ultraState = classifyUltraWideState(detected.rear, main, telephoto);

  return {
    ...detected,
    main,
    telephoto,
    ultrawide: ultraState.ultrawide,
    ultraConfidence: ultraState.confidence,
    needsManualLensPick: ultraState.needsManualLensPick,
    ultraRanked: ultraState.ranked,
    rearOptions: detected.rear,
    probes: Object.fromEntries(
      detected.rear
        .map((d) => [d.deviceId, deviceProbeCache.get(d.deviceId)])
        .filter(([, v]) => v),
    ),
  };
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

/**
 * W3C PTZ: zoom caps only count when min/max are real numbers.
 * Empty `{}` / missing numbers (no PTZ permission) → not supported.
 * @param {unknown} zoomCaps
 * @returns {{ min: number, max: number, step: number } | null}
 */
export function parseZoomCapability(zoomCaps) {
  if (!zoomCaps || typeof zoomCaps !== "object") return null;
  const min = Number(/** @type {{min?: unknown}} */ (zoomCaps).min);
  const max = Number(/** @type {{max?: unknown}} */ (zoomCaps).max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (!(max >= min)) return null;
  const stepRaw = Number(/** @type {{step?: unknown}} */ (zoomCaps).step);
  const step = Number.isFinite(stepRaw) && stepRaw > 0 ? stepRaw : 0.1;
  return { min, max, step };
}

/** Page must be visible for applyConstraints PTZ (W3C SecurityError otherwise). */
export function isPageVisibleForPtz() {
  try {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible";
  } catch {
    return true;
  }
}

export function supportsHardwareZoom(stream) {
  const caps = getCurrentTrackCapabilities(stream);
  return Boolean(parseZoomCapability(caps?.zoom));
}

export function readZoomRange(stream) {
  const caps = getCurrentTrackCapabilities(stream);
  const parsed = parseZoomCapability(caps?.zoom);
  if (!parsed) {
    return { minZoom: 1, maxZoom: 1, zoomStep: 0.1, supported: false };
  }
  return {
    minZoom: parsed.min,
    maxZoom: parsed.max,
    zoomStep: parsed.step,
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

/** High-res open — Full HD @ 60 ideal (no hard max; browser negotiates) */
function highResQuality(base = {}) {
  return {
    ...getCameraPreviewConstraints(base),
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 60 },
  };
}

/** Flip cam — nhẹ hơn một chút để mở nhanh, vẫn ≥720p ideal */
function flipFastQuality() {
  return {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
  };
}

function canRequestBrowserZoomControl() {
  try {
    return Boolean(
      navigator.mediaDevices?.getSupportedConstraints?.()?.zoom,
    );
  } catch {
    return false;
  }
}

/**
 * Build video constraints; only add zoom:true when supported (never zoom:undefined).
 * W3C: zoom:true requests PTZ permission without setting initial zoom value.
 * Never put min/max/exact on zoom in basic getUserMedia constraints.
 * @param {MediaTrackConstraints} base
 * @param {{ requestZoomControl?: boolean }} [options]
 */
function withOptionalZoomTrue(base, options = {}) {
  const video = { ...(base || {}) };
  // Strip accidental zoom value constraints from callers
  if (
    video.zoom != null &&
    typeof video.zoom === "object" &&
    ("min" in video.zoom || "max" in video.zoom || "exact" in video.zoom)
  ) {
    delete video.zoom;
  }
  if (options.requestZoomControl && canRequestBrowserZoomControl()) {
    video.zoom = true;
  }
  return video;
}

/**
 * getUserMedia OK → bump quality if track allows (safe no-op on fail).
 *
 * W3C / Chromium PTZ:
 *  - zoom:true = request PTZ control without altering current zoom
 *  - old camera permission does NOT auto-upgrade to PTZ
 *  - if zoom:true fails → regular camera open
 *  - Android: zoom only (no pan/tilt)
 */
async function openAndUpgrade(videoConstraints, options = {}) {
  const supportedZoom = canRequestBrowserZoomControl();
  let stream = null;
  let openPath = "plain";
  const wantZoom =
    options.requestZoomControl === true &&
    supportedZoom &&
    videoConstraints &&
    typeof videoConstraints === "object";

  if (wantZoom) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: withOptionalZoomTrue(videoConstraints, {
          requestZoomControl: true,
        }),
        audio: false,
      });
      openPath = "zoom-true";
    } catch (error) {
      console.warn("[camera-ptz] zoom permission/open failed", {
        name: error?.name,
        message: error?.message,
      });
      logCameraPtz({
        path: "open",
        supportedZoom,
        applyResult: "zoom-true-rejected",
        errorName: error?.name || null,
        errorMessage: error?.message || String(error),
      });
    }
  }
  if (!stream) {
    // Plain open — no zoom key at all
    const plain = { ...(videoConstraints || {}) };
    if ("zoom" in plain) delete plain.zoom;
    stream = await navigator.mediaDevices.getUserMedia({
      video: plain,
      audio: false,
    });
    openPath = wantZoom ? "plain-fallback" : "plain";
  }
  try {
    await upgradeStreamQuality(stream);
  } catch {
    /* keep stream */
  }
  const track = getActiveVideoTrack(stream);
  let caps = {};
  let settings = {};
  try {
    caps = track?.getCapabilities?.() || {};
    settings = track?.getSettings?.() || {};
  } catch {
    /* ignore */
  }
  const zoomParsed = parseZoomCapability(caps.zoom);
  logCameraPtz({
    path: openPath,
    supportedZoom,
    zoomCapabilities: zoomParsed,
    zoomAfter: settings.zoom ?? null,
    selectedDeviceId: settings.deviceId || null,
    trackState: track?.readyState || null,
    applyResult: isLiveVideoStream(stream) ? "live" : "not-live",
  });
  return stream;
}

function readFacingMode(stream) {
  try {
    return stream?.getVideoTracks?.()?.[0]?.getSettings?.()?.facingMode || null;
  } catch {
    return null;
  }
}

/**
 * Mở cam theo hướng (user | environment) — KHÔNG tin deviceId cache
 * (tránh đảo cam trước/sau khi classify nhầm label).
 */
export async function openCameraByFacing(facingMode, options = {}) {
  const want = facingMode === "user" ? "user" : "environment";
  const quality = options.fast
    ? flipFastQuality()
    : getCameraPreviewConstraints(
        CONFIG?.app?.camera?.constraints?.default || {},
      );
  const tryOpen = (video) =>
    openAndUpgrade(video, { requestZoomControl: want === "environment" });

  const attempts = [
    // exact facing — đúng cam nhất
    { facingMode: { exact: want }, ...quality },
    { facingMode: { ideal: want }, ...quality },
    { facingMode: want, ...quality },
  ];

  let lastErr = null;
  for (const video of attempts) {
    try {
      const stream = await tryOpen(video);
      const actual = readFacingMode(stream);
      // Nếu browser báo facing sai → bỏ stream, thử attempt sau
      if (actual && actual !== want) {
        stopCurrentCamera(stream);
        continue;
      }
      return stream;
    } catch (e) {
      lastErr = e;
    }
  }

  // Fallback deviceId chỉ khi facingMode fail hoàn toàn
  if (options.deviceId) {
    try {
      return await tryOpen({
        deviceId: { exact: options.deviceId },
        ...quality,
      });
    } catch (e) {
      lastErr = e;
    }
    try {
      return await tryOpen({
        deviceId: { ideal: options.deviceId },
        facingMode: { ideal: want },
        ...quality,
      });
    } catch (e) {
      lastErr = e;
    }
  }

  // Last-chance: bare facingMode without quality (max compatibility)
  try {
    return await openAndUpgrade(
      { facingMode: want },
      { requestZoomControl: want === "environment" },
    );
  } catch (e) {
    lastErr = e;
  }

  throw lastErr || new Error(`Không mở được camera ${want}`);
}

export async function startCameraByDeviceId(deviceId, options = {}) {
  const {
    facingMode = "environment",
    // Default false: preview mượt; chụp/quay vẫn lấy frame từ track
    highRes = false,
    preferDeviceId = true,
    // Flip front↔rear: constraint nhẹ + facingMode-first
    fast = false,
    // Flip: bỏ deviceId, chỉ facingMode (tránh đảo cam)
    facingOnly = false,
    // Ultra / tele: BẮT BUỘC exact deviceId — ideal hay bị browser giữ cam chính
    forceDeviceId = false,
  } = options;

  const quality = highRes
    ? highResQuality(CONFIG?.app?.camera?.constraints?.default || {})
    : fast
      ? flipFastQuality()
      : getCameraPreviewConstraints(
          CONFIG?.app?.camera?.constraints?.default || {},
        );

  const want = facingMode === "user" ? "user" : "environment";
  const tryOpen = (video) =>
    openAndUpgrade(video, { requestZoomControl: want === "environment" });

  // Flip cam: CHỈ facingMode — deviceId enumerate hay gán nhầm front/rear
  if (fast || facingOnly) {
    try {
      return await openCameraByFacing(want, {
        fast: true,
        // không truyền deviceId khi flip
        deviceId: facingOnly ? null : null,
      });
    } catch {
      /* fall through */
    }
  }

  // Lens cụ thể (0.5x ultra / 2x tele): ưu tiên exact deviceId
  if (preferDeviceId && deviceId) {
    // forceDeviceId / ultra: exact TRƯỚC — không để browser “ideal” ra cam 1x
    if (forceDeviceId) {
      try {
        return await tryOpen({ deviceId: { exact: deviceId }, ...quality });
      } catch {
        try {
          return await tryOpen({
            deviceId: { exact: deviceId },
            facingMode: { ideal: want },
            ...quality,
          });
        } catch {
          /* fall through to ideal */
        }
      }
    }
    try {
      // exact trước ideal (fix góc siêu rộng bị kẹt main)
      return await tryOpen({ deviceId: { exact: deviceId }, ...quality });
    } catch {
      try {
        const stream = await tryOpen({
          deviceId: { ideal: deviceId },
          facingMode: { ideal: want },
          ...quality,
        });
        return stream;
      } catch {
        /* fall through */
      }
    }
  }

  try {
    return await openCameraByFacing(want, { fast: false, deviceId: null });
  } catch {
    /* fall through */
  }

  try {
    return await tryOpen({ facingMode: { ideal: want }, ...quality });
  } catch {
    try {
      return await tryOpen({ facingMode: { exact: want }, ...quality });
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

  return tryOpen({ facingMode: { ideal: want }, ...quality });
}

/** Clamp zoom to [min, max] */
export function clampZoom(value, minZoom = 1, maxZoom = 1) {
  const v = Number(value);
  if (!Number.isFinite(v)) return minZoom;
  return Math.max(minZoom, Math.min(v, maxZoom));
}

/**
 * Cache min/max/last zoom + which constraint shape worked on this track.
 * Avoid getCapabilities / multi-format fallback every pinch frame (Android lag).
 */
const trackZoomCache = new WeakMap();

/** Refresh caps from track at most this often during continuous zoom */
const ZOOM_CAPS_TTL_MS = 2500;
/** Skip applyConstraints if nearly identical (continuous / pinch) */
const ZOOM_FAST_EPS = 0.008;
/** Skip applyConstraints if delta smaller than this (presets / deliberate) */
const ZOOM_PRECISE_EPS = 0.01;
/** Default min gap between hardware applies during continuous zoom */
export const ZOOM_APPLY_THROTTLE_MS = 40;

/**
 * Apply digital / hardware zoom (required API).
 * @param {MediaStream|null} stream
 * @param {number} zoomValue
 * @param {{ fast?: boolean, forceCaps?: boolean, continuous?: boolean }} [options]
 * @returns {Promise<number|false>}
 */
export async function applyCameraZoom(stream, zoomValue, options = {}) {
  return setCameraZoom(stream, zoomValue, options);
}

/**
 * Continuous zoom on the CURRENT track only.
 * Never getUserMedia / never change deviceId — safe while on ultra-wide.
 *
 * @param {MediaStream|null} stream
 * @param {number} value
 * @param {{ fast?: boolean, forceCaps?: boolean, continuous?: boolean }} [options]
 *   fast: no getSettings verify, reuse constraint style
 *   continuous: do NOT snap to step (UI rounds for display only)
 * @returns {Promise<number|false>}
 */
export async function setCameraZoom(stream, value, options = {}) {
  const { fast = false, forceCaps = false, continuous = false } = options;
  const track = getActiveVideoTrack(stream);
  if (!track || track.readyState !== "live") return false;

  // W3C: applyConstraints PTZ fails with SecurityError if page not visible
  if (!isPageVisibleForPtz()) {
    if (fast || continuous) return false;
    const ok = await waitForPageVisible(4000);
    if (!ok) {
      logCameraPtz({
        path: "apply-zoom",
        applyResult: "page-not-visible",
        requestedZoom: value,
        trackState: track.readyState,
      });
      return false;
    }
  }

  const now = Date.now();
  let cached = trackZoomCache.get(track);
  const capsStale =
    forceCaps ||
    !cached ||
    !Number.isFinite(cached.min) ||
    now - (cached.capsAt || 0) > ZOOM_CAPS_TTL_MS;

  if (capsStale) {
    const caps = getCurrentTrackCapabilities(stream);
    const parsed = parseZoomCapability(caps?.zoom);
    if (!parsed) return false;
    cached = {
      min: parsed.min,
      max: parsed.max,
      step: parsed.step,
      last: cached?.last ?? null,
      style: cached?.style ?? null,
      capsAt: now,
    };
    trackZoomCache.set(track, cached);
  }

  let next = clampZoom(value, cached.min, cached.max);
  // Snap to OEM step only for discrete presets — continuous pinch/slider
  // sends the raw clamped value (display layer rounds separately).
  if (
    !continuous &&
    Number.isFinite(cached.step) &&
    cached.step > 0 &&
    cached.step < 1
  ) {
    const snapped =
      Math.round((next - cached.min) / cached.step) * cached.step +
      cached.min;
    next = clampZoom(snapped, cached.min, cached.max);
    next = Math.round(next * 1000) / 1000;
  }

  const eps = fast || continuous ? ZOOM_FAST_EPS : ZOOM_PRECISE_EPS;
  if (cached.last != null && Math.abs(cached.last - next) < eps) {
    return cached.last;
  }

  // Prefer the constraint shape that already worked on this track
  const advanced = { advanced: [{ zoom: next }] };
  const bare = /** @type {MediaTrackConstraints} */ ({ zoom: next });
  const ideal = { advanced: [{ zoom: { ideal: next } }] };
  /** @type {Array<{ style: string, c: MediaTrackConstraints }>} */
  let attempts;
  if (cached.style === "bare") {
    attempts = [
      { style: "bare", c: bare },
      { style: "advanced", c: advanced },
      { style: "ideal", c: ideal },
    ];
  } else if (cached.style === "ideal") {
    attempts = [
      { style: "ideal", c: ideal },
      { style: "advanced", c: advanced },
      { style: "bare", c: bare },
    ];
  } else {
    attempts = [
      { style: "advanced", c: advanced },
      { style: "bare", c: bare },
      { style: "ideal", c: ideal },
    ];
  }
  // Continuous: one style only after warm-up
  if ((fast || continuous) && cached.style) {
    attempts = attempts.slice(0, 1);
  } else if (fast || continuous) {
    attempts = attempts.slice(0, 2);
  }

  let lastError = null;
  for (const { style, c } of attempts) {
    try {
      await track.applyConstraints(c);
      if (track.readyState !== "live") return false;
      cached.style = style;
      // Continuous/pinch: trust requested value — never getSettings mid-gesture
      if (fast || continuous) {
        cached.last = next;
        return next;
      }
      const applied = getCurrentTrackSettings(stream)?.zoom;
      cached.last =
        typeof applied === "number" && Number.isFinite(applied) ? applied : next;
      return cached.last;
    } catch (error) {
      lastError = error;
      if (fast || continuous) cached.style = null;
    }
  }

  if (lastError && !fast && !continuous) {
    logCameraPtz({
      action: "apply-zoom",
      applyResult: "error",
      errorName: lastError?.name || null,
      errorMessage: lastError?.message || String(lastError),
      trackState: track.readyState,
    });
  }
  return false;
}

/**
 * Latest-value-wins camera zoom applier.
 * UI must update displayZoom independently — this only talks to the track.
 *
 * @param {() => MediaStream|null|undefined} getStream
 * @param {{ minIntervalMs?: number, onApplied?: (z: number|false) => void }} [opts]
 */
export function createLatestZoomApplier(getStream, opts = {}) {
  const minIntervalMs = opts.minIntervalMs ?? ZOOM_APPLY_THROTTLE_MS;
  let applying = false;
  let pending = null;
  let lastAt = 0;

  async function pump() {
    if (applying) return;
    applying = true;
    try {
      while (pending != null) {
        let latest = pending;
        pending = null;

        const elapsed = Date.now() - lastAt;
        if (lastAt > 0 && elapsed < minIntervalMs) {
          await new Promise((r) =>
            setTimeout(r, minIntervalMs - elapsed),
          );
          // Prefer value that arrived during the wait
          if (pending != null) {
            latest = pending;
            pending = null;
          }
        }

        const stream =
          typeof getStream === "function" ? getStream() : null;
        if (!stream || !isLiveVideoStream(stream)) {
          lastAt = Date.now();
          continue;
        }

        lastAt = Date.now();
        const applied = await setCameraZoom(stream, latest, {
          fast: true,
          continuous: true,
        });
        try {
          opts.onApplied?.(applied);
        } catch {
          /* ignore UI callbacks */
        }
      }
    } finally {
      applying = false;
      if (pending != null) {
        void pump();
      }
    }
  }

  return {
    /** Queue latest zoom; never blocks the UI thread for intermediate values */
    request(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return;
      pending = n;
      void pump();
    },
    get pending() {
      return pending;
    },
    get busy() {
      return applying;
    },
  };
}

/** Clear zoom cache when stream stops (optional) */
export function clearTrackZoomCache(stream) {
  const track = getActiveVideoTrack(stream);
  if (track) trackZoomCache.delete(track);
}

/** Format badge text: 0.5x, 0.6x, 1x, 1.4x, 2x… — never invent numbers. */
export function updateZoomBadge(value) {
  if (value === "UW" || value === "uw") return "UW";
  const n = Number(value);
  // Unknown / missing → blank marker (callers prefer getLiveZoomDisplay)
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (Math.abs(n - 1) < 0.05) return "1x";
  // góc rộng: hiện 1 chữ số thập phân (0.5 / 0.6 / 0.7)
  if (n > 0.2 && n < 0.95) {
    const r = roundZoomFactor(n);
    return `${r != null ? r : Number(n.toFixed(1))}x`;
  }
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.05) {
    return `${Math.round(n)}x`;
  }
  return `${Number(n.toFixed(1))}x`;
}

/**
 * Hệ số góc siêu rộng thực tế: 0.5 / 0.6 / 0.7… theo máy.
 * null = không hỗ trợ ultra.
 */
export function getUltraWideFactor(stream, detected = null) {
  return resolveUltraWideFactor(stream, detected, null);
}

/**
 * Live zoom label for badge / presets — single source of truth.
 * Prefers track getSettings().zoom + capabilities.min; never invents 0.5/0.6.
 *
 * @param {MediaStream|null} stream
 * @param {{
 *   lensType?: string|null,
 *   detected?: object|null,
 *   preferredMode?: string|null,
 *   uiZoom?: number|null,
 * }} [options]
 * @returns {{
 *   value: number|null,
 *   label: string,
 *   ultraFactor: number|null,
 *   inUltraBand: boolean,
 *   onPhysicalUltra: boolean,
 * }}
 */
export function getLiveZoomDisplay(stream = null, options = {}) {
  const {
    lensType = null,
    detected = null,
    preferredMode = null,
    uiZoom = null,
  } = options;

  const live = readLiveZoomFromCamera(stream);
  let settingsId = null;
  try {
    settingsId = getCurrentTrackSettings(stream)?.deviceId || null;
  } catch {
    /* ignore */
  }
  const ultraId = detected?.ultrawide?.deviceId || null;
  const onPhysicalUltra =
    lensType === "ultrawide" ||
    Boolean(ultraId && settingsId && settingsId === ultraId);

  const liveCurrent =
    typeof live.current === "number" && Number.isFinite(live.current)
      ? live.current
      : null;
  const liveMin =
    typeof live.min === "number" && Number.isFinite(live.min)
      ? live.min
      : null;
  const ui =
    typeof uiZoom === "number" && Number.isFinite(uiZoom) ? uiZoom : null;

  // Prefer live settings; keep UI only when HAL lags at 1x after logical UW park
  let numeric = liveCurrent;
  if (liveCurrent != null && isUltraZoomValue(liveCurrent)) {
    numeric = liveCurrent;
  } else if (
    ui != null &&
    isUltraZoomValue(ui) &&
    (liveCurrent == null || Math.abs(liveCurrent - 1) < 0.08)
  ) {
    numeric = ui;
  } else if (numeric == null && ui != null) {
    numeric = ui;
  } else if (
    numeric == null &&
    liveMin != null &&
    isUltraZoomValue(liveMin) &&
    (preferredMode == null || isWideZoomMode(preferredMode) || onPhysicalUltra)
  ) {
    numeric = liveMin;
  }

  const factor = resolveUltraWideFactor(
    stream,
    detected,
    isUltraZoomValue(numeric)
      ? numeric
      : isUltraZoomValue(liveMin)
        ? liveMin
        : null,
  );

  const wideMode = preferredMode != null && isWideZoomMode(preferredMode);
  const minIsMainOnly =
    liveMin == null || !Number.isFinite(liveMin) || Number(liveMin) >= 0.98;

  // Physical UW (or UW mode) at native FOV with no ultra-band zoom number → "UW"
  // Do NOT show "1x" (that reads as main lens).
  if (
    (onPhysicalUltra || wideMode) &&
    minIsMainOnly &&
    !isUltraZoomValue(numeric) &&
    !isUltraZoomValue(factor)
  ) {
    if (numeric != null && Number(numeric) > 1.15) {
      const r = roundZoomFactor(numeric) ?? Number(numeric.toFixed(1));
      return {
        value: r,
        label: updateZoomBadge(r),
        ultraFactor: factor,
        inUltraBand: false,
        onPhysicalUltra,
      };
    }
    return {
      value: null,
      label: "UW",
      ultraFactor: factor,
      inUltraBand: true,
      onPhysicalUltra,
    };
  }

  if (numeric != null && Number.isFinite(numeric)) {
    const r =
      isUltraZoomValue(numeric) || numeric < 0.98
        ? roundZoomFactor(numeric) ?? Math.round(numeric * 10) / 10
        : Math.abs(numeric - 1) < 0.05
          ? 1
          : roundZoomFactor(numeric) ?? Math.round(numeric * 10) / 10;
    return {
      value: r,
      label: updateZoomBadge(r),
      ultraFactor: factor ?? (isUltraZoomValue(r) ? r : null),
      inUltraBand: isUltraZoomValue(r),
      onPhysicalUltra,
    };
  }

  if (factor != null) {
    return {
      value: factor,
      label: updateZoomBadge(factor),
      ultraFactor: factor,
      inUltraBand: true,
      onPhysicalUltra,
    };
  }

  if (onPhysicalUltra || wideMode) {
    return {
      value: null,
      label: "UW",
      ultraFactor: null,
      inUltraBand: true,
      onPhysicalUltra,
    };
  }

  return {
    value: 1,
    label: "1x",
    ultraFactor: null,
    inUltraBand: false,
    onPhysicalUltra: false,
  };
}

/**
 * Nhãn nút zoom — ultra chỉ hiện số KHI đã đọc từ camera (ultraFactor).
 * Chưa đo được → "UW" (không bịa 0.5/0.6).
 */
export function formatZoomModeLabel(mode, ultraFactor = null) {
  if (isWideZoomMode(mode)) {
    const f = Number(ultraFactor);
    if (isUltraZoomValue(f)) {
      const r = roundZoomFactor(f);
      return r != null ? String(r) : "UW";
    }
    // Physical ultra but caps not exposed yet — never invent 0.5/0.6
    return "UW";
  }
  if (mode === "1x") return "1";
  if (mode === "2x") return "2";
  if (mode === "3x") return "3";
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
 * Dọn zoom control LẠC trong vùng caption/editor thôi.
 *
 * TUYỆT ĐỐI KHÔNG xóa:
 * - [data-zoom-slider] / [data-zoom-presets] của camera React (gây removeChild crash)
 * - Bất kỳ node nào React đang render trong #root camera frame
 *
 * Chỉ gỡ leftover trong .editor-caption / caption tools.
 */
export function removeCaptionZoomControls(root = document) {
  if (typeof document === "undefined") return;
  try {
    // Chỉ trong caption editor — không quét toàn document
    const scopes = [
      root.querySelector?.(".editor-caption"),
      root.querySelector?.("[data-caption-editor]"),
      root.querySelector?.(".caption-tools"),
    ].filter(Boolean);

    if (!scopes.length) return;

    const selectors = [
      "[data-caption-zoom]",
      ".caption-zoom",
      ".caption-zoom-bar",
      ".zoom-slider",
      ".zoom-bar",
      'input[type="range"][data-camera-zoom]',
      ".zoom-control",
      'input[type="range"]',
    ];

    for (const scope of scopes) {
      for (const sel of selectors) {
        scope.querySelectorAll?.(sel)?.forEach((el) => {
          // Không đụng camera zoom UI
          if (
            el.closest?.("[data-zoom-slider]") ||
            el.closest?.("[data-zoom-presets]") ||
            el.closest?.("[data-locket-camera]")
          ) {
            return;
          }
          try {
            el.remove();
          } catch {
            /* ignore */
          }
        });
      }
    }
  } catch {
    /* ignore */
  }
}

// ─── Available modes + resolve ────────────────────────────────────

export function computeAvailableZoomModes(detected, stream) {
  const range = readZoomRange(stream);
  const multiRear = (detected?.rear?.length || 0) >= 2;
  // Display factor ONLY from live stream — never a fixed 0.5 assumption
  const ultraFactor = resolveUltraWideFactor(stream, detected, null);
  const ultraCandidates = listUltraWideCandidates(
    detected?.rear || [],
    detected?.main || null,
    detected?.telephoto || null,
  );
  const hasClassifiedUltra = Boolean(detected?.ultrawide?.deviceId);
  const hasUltraCandidates = ultraCandidates.length > 0;
  const conf = detected?.ultraConfidence || null;

  // Digital wide on the *current* track (logical multi-cam / Dual Wide)
  const digitalWideRange =
    range.supported && isUltraZoomValue(range.minZoom);
  // Track supports continuous zoom at all (park min for "widest")
  const hasAnyZoom =
    range.supported &&
    Number.isFinite(range.minZoom) &&
    Number.isFinite(range.maxZoom) &&
    range.maxZoom > range.minZoom + 0.05;

  // Feature detection only (enumerate multi-rear · live zoom caps · labels).
  // No hard-coded 0.5/0.6. UI may still force the UW pill on rear cameras.
  const canWide =
    hasClassifiedUltra ||
    multiRear ||
    hasUltraCandidates ||
    digitalWideRange ||
    hasAnyZoom ||
    conf === "high" ||
    conf === "medium" ||
    conf === "low";

  // Internal mode key stays "0.5x"; UI label uses live ultraFactor or "UW"
  const modes = {
    "0.5x": Boolean(canWide),
    "1x": true,
    "2x": false,
    "3x": false,
    ultraFactor: canWide ? ultraFactor : null,
    ultraConfidence: conf,
    needsManualLensPick: Boolean(detected?.needsManualLensPick),
    rearOptions: detected?.rearOptions || detected?.rear || [],
  };

  // 2x / 3x — theo tele hoặc max digital zoom của máy
  if (detected?.telephoto?.deviceId) {
    modes["2x"] = true;
    modes["3x"] = true;
  }
  if (range.supported && range.maxZoom >= 1.8) modes["2x"] = true;
  else if (range.supported && range.maxZoom > range.minZoom + 0.2) {
    modes["2x"] = true;
  }
  if (range.supported && range.maxZoom >= 2.7) modes["3x"] = true;

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

  // Widest FOV pill — mode key may be "0.5x"; numeric target = live zoom.min only
  if (isWideZoomMode(m)) {
    const liveMin =
      range.supported && Number.isFinite(range.minZoom) ? range.minZoom : null;
    const factor =
      resolveUltraWideFactor(stream, detected, liveMin) ??
      (liveMin != null && liveMin < 0.98 ? roundZoomFactor(liveMin) : null);
    // After open, park at capabilities.min (OEM-specific 0.5/0.6/0.7…)
    const parkZoom =
      liveMin != null ? liveMin : range.supported ? range.minZoom : null;

    // 1) Ultra vật lý
    if (ultraId) {
      return {
        deviceId: ultraId,
        digitalZoom: parkZoom,
        displayZoom: factor,
        lensType: "ultrawide",
        mode: WIDE_ZOOM_MODE,
        ultraFactor: factor,
      };
    }
    // 2) Ứng viên multi-rear (sorted by universal score)
    const candidates = listUltraWideCandidates(
      detected?.rear || [],
      detected?.main || null,
      detected?.telephoto || null,
    ).filter((id) => id && id !== mainId);
    if (candidates.length) {
      return {
        deviceId: candidates[0],
        candidateDeviceIds: candidates,
        digitalZoom: parkZoom,
        displayZoom: factor,
        lensType: "ultrawide",
        mode: WIDE_ZOOM_MODE,
        ultraFactor: factor,
      };
    }
    // 3) Digital on current track — park at live min only
    if (range.supported && isUltraZoomValue(range.minZoom)) {
      const z = range.minZoom;
      const f = roundZoomFactor(z);
      return {
        deviceId: mainId,
        digitalZoom: z,
        displayZoom: f,
        lensType: "main",
        mode: WIDE_ZOOM_MODE,
        ultraFactor: f,
      };
    }
    // Không hỗ trợ
    return {
      deviceId: null,
      digitalZoom: null,
      displayZoom: null,
      lensType: null,
      mode: WIDE_ZOOM_MODE,
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

  if (m === "3x" || m === "3") {
    if (range.supported && range.maxZoom >= 2.7) {
      return {
        deviceId: mainId,
        digitalZoom: Math.min(3, range.maxZoom),
        displayZoom: Math.min(3, range.maxZoom),
        lensType: "main",
        mode: "3x",
      };
    }
    if (teleId) {
      return {
        deviceId: teleId,
        digitalZoom: 1,
        displayZoom: 3,
        lensType: "telephoto",
        mode: "3x",
      };
    }
    return {
      deviceId: null,
      digitalZoom: null,
      displayZoom: null,
      lensType: null,
      mode: "3x",
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
 * min: ultra factor thật (0.5/0.6/0.7) khi máy hỗ trợ — không ép 0.5 mù
 * max: track max (or higher if tele)
 */
export function getEffectiveZoomBounds(detected, stream) {
  const range = readZoomRange(stream);
  let min = range.supported ? range.minZoom : 1;
  let max = range.supported ? range.maxZoom : 1;

  const hasUltra = Boolean(detected?.ultrawide?.deviceId);
  const ultraFactor = getUltraWideFactor(stream, detected);
  const canWide =
    Boolean(ultraFactor) ||
    hasUltra ||
    (range.supported && range.minZoom > 0.15 && range.minZoom < 0.95);

  // Pinch min = minZoom THẬT từ track (không đoán hãng)
  if (canWide && ultraFactor && ultraFactor < 0.95) {
    min = Math.min(min, ultraFactor);
  }
  if (range.supported && range.minZoom > 0.15 && range.minZoom < 0.95) {
    min = Math.min(min, range.minZoom);
  } else if (hasUltra && min > 0.5) {
    // Có lens ultra nhưng track chưa expose min < 1 — giữ min=1 đến khi switch
    // (không gán 0.5/0.6 giả)
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
    // Chỉ số từ cam thật — null nếu chưa đọc được
    ultraFactor: canWide ? ultraFactor : null,
    canGo05: canWide,
  };
}

/**
 * Map display zoom → which lens + track zoom to apply.
 * Never uses tele by default; tele only when displayZoom >= ~2 and no digital.
 *
 * CRITICAL (zoom on ultra-wide):
 * Once the live stream is already on the physical ultra deviceId, continuous
 * zoom must STAY on that lens — digitalZoom = clamp(z, caps.min, caps.max).
 * Thresholds come from live min / ultraFactor, never hard-coded 0.5.
 * Leaving ultra is only for explicit preset 1x / switchToMain (UI), not pinch.
 */
export function mapDisplayZoomToLens(displayZoom, detected, stream) {
  const z = Number(displayZoom) || 1;
  const mainId = detected?.main?.deviceId || detected?.rear?.[0]?.deviceId || null;
  const ultraId = detected?.ultrawide?.deviceId || null;
  const teleId = detected?.telephoto?.deviceId || null;
  const range = readZoomRange(stream);
  const liveId = getCurrentTrackSettings(stream)?.deviceId || null;
  const onPhysicalUltra = Boolean(ultraId && liveId && liveId === ultraId);
  const liveFactor = resolveUltraWideFactor(stream, detected, null);
  const thr = wideBandThreshold(stream, liveFactor);

  // ── Already on physical ultra-wide: sticky lens, continuous track zoom ──
  if (onPhysicalUltra) {
    const digi = range.supported
      ? clampZoom(z, range.minZoom, range.maxZoom)
      : z;
    const factor = resolveUltraWideFactor(stream, detected, digi);
    let mode = "custom";
    if (range.supported && digi <= range.minZoom + 0.08) mode = WIDE_ZOOM_MODE;
    else if (Math.abs(digi - 1) < 0.12) mode = "1x";
    else if (digi >= 1.7) mode = "2x";
    else if (digi < thr) mode = WIDE_ZOOM_MODE;
    return {
      deviceId: ultraId,
      digitalZoom: digi,
      displayZoom: digi,
      lensType: "ultrawide",
      mode,
      switchDevice: false,
      ultraFactor: factor,
    };
  }

  // ── wide band: need ultra lens / digital min (not yet on ultra deviceId) ──
  if (z < thr) {
    const factor = resolveUltraWideFactor(stream, detected, null);

    if (ultraId) {
      // First hop onto ultra: open device; park at native/min zoom once.
      return {
        deviceId: ultraId,
        digitalZoom: range.supported
          ? clampZoom(
              factor != null ? factor : range.minZoom,
              range.minZoom,
              range.maxZoom,
            )
          : null,
        displayZoom: factor != null ? factor : z,
        lensType: "ultrawide",
        mode: WIDE_ZOOM_MODE,
        switchDevice: true,
      };
    }
    if (range.supported && isUltraZoomValue(range.minZoom)) {
      return {
        deviceId: mainId,
        digitalZoom: clampZoom(z, range.minZoom, range.maxZoom),
        displayZoom: z,
        lensType: "main",
        mode: WIDE_ZOOM_MODE,
        switchDevice: false,
      };
    }
    // No ultra & no digital-out → stay main at live min (cannot go wider)
    return {
      deviceId: mainId,
      digitalZoom: range.supported ? range.minZoom : 1,
      displayZoom:
        range.supported && range.minZoom < 1 ? range.minZoom : 1,
      lensType: "main",
      mode:
        range.supported && isUltraZoomValue(range.minZoom)
          ? WIDE_ZOOM_MODE
          : "1x",
      switchDevice: false,
      unavailable05: !range.supported || !isUltraZoomValue(range.minZoom),
    };
  }

  // High zoom: use track max on main first; tele only if track can't reach
  if (z >= 1.9 && teleId && (!range.supported || range.maxZoom < 1.8)) {
    return {
      deviceId: teleId,
      digitalZoom: range.supported
        ? clampZoom(1, range.minZoom, range.maxZoom)
        : 1,
      displayZoom: z,
      lensType: "telephoto",
      mode: "2x",
      switchDevice: true,
    };
  }

  // Main band — clamp to live caps only
  let digital = 1;
  if (range.supported) {
    digital = clampZoom(z, range.minZoom, range.maxZoom);
  }

  let mode = "1x";
  if (z >= 1.7) mode = "2x";
  else if (z < thr && range.supported && isUltraZoomValue(range.minZoom)) {
    mode = WIDE_ZOOM_MODE;
  }

  return {
    deviceId: mainId,
    digitalZoom: digital,
    displayZoom: z,
    lensType: "main",
    mode,
    switchDevice: false,
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

/**
 * Logical PTZ ultra-wide: only when zoom.min < 0.98 (OEM may report 0.5/0.6…).
 * W3C: min is often 1 — that is NOT ultra-wide; never invent 0.6 success.
 * @returns {Promise<object|null>}
 */
async function tryDigitalUltraWide(stream, detected, mainId) {
  if (!stream || !isLiveVideoStream(stream)) return null;

  const range = readZoomRange(stream);
  // !zoomCaps or min >= 0.98 → PTZ is in-lens zoom only, not UW
  if (!range.supported || Number(range.minZoom) >= 0.98) {
    logCameraPtz({
      path: "logical-zoom",
      rearCameraCount: detected?.rear?.length ?? null,
      zoomCapabilities: range.supported
        ? {
            min: range.minZoom,
            max: range.maxZoom,
            step: range.zoomStep,
          }
        : null,
      applyResult: "not-ultra-band",
      trackState: getActiveVideoTrack(stream)?.readyState || null,
    });
    return null;
  }
  if (!isUltraZoomValue(range.minZoom)) return null;

  try {
    if (!isPageVisibleForPtz()) {
      const vis = await waitForPageVisible(8000);
      if (!vis) {
        logCameraPtz({
          path: "logical-zoom",
          applyResult: "page-not-visible",
          requestedZoom: range.minZoom,
        });
        return null;
      }
    }

    const track = getActiveVideoTrack(stream);
    const zoomBefore = getCurrentTrackSettings(stream)?.zoom ?? null;
    const requestedZoom = Number(range.minZoom);

    // Direct W3C applyConstraints pattern
    try {
      await track.applyConstraints({
        advanced: [{ zoom: requestedZoom }],
      });
    } catch {
      // Fall back through setCameraZoom (multiple formats)
      const applied = await setCameraZoom(stream, requestedZoom);
      if (applied === false) return null;
    }

    await new Promise((r) => setTimeout(r, 100));
    if (!isLiveVideoStream(stream)) return null;

    const actualZoom = getCurrentTrackSettings(stream)?.zoom;
    const ok =
      typeof actualZoom === "number" &&
      Number.isFinite(actualZoom) &&
      Math.abs(actualZoom - requestedZoom) <=
        Math.max(0.15, (range.zoomStep || 0.1) * 2);

    if (!ok) {
      logCameraPtz({
        path: "logical-zoom",
        zoomCapabilities: {
          min: range.minZoom,
          max: range.maxZoom,
          step: range.zoomStep,
        },
        zoomBefore,
        requestedZoom,
        zoomAfter: actualZoom ?? null,
        selectedDeviceId: getCurrentTrackSettings(stream)?.deviceId || mainId,
        trackState: getActiveVideoTrack(stream)?.readyState || null,
        applyResult: "actual-mismatch",
      });
      // Still accept if actual is in ultra band even if not exact match
      if (
        typeof actualZoom !== "number" ||
        !isUltraZoomValue(actualZoom)
      ) {
        return null;
      }
    }

    const factor = resolveUltraWideFactor(
      stream,
      detected,
      typeof actualZoom === "number" && isUltraZoomValue(actualZoom)
        ? actualZoom
        : requestedZoom,
    );
    logCameraPtz({
      path: "logical-zoom",
      rearCameraCount: detected?.rear?.length ?? null,
      zoomCapabilities: {
        min: range.minZoom,
        max: range.maxZoom,
        step: range.zoomStep,
      },
      zoomBefore,
      requestedZoom,
      zoomAfter: actualZoom ?? null,
      selectedDeviceId: getCurrentTrackSettings(stream)?.deviceId || mainId,
      trackState: getActiveVideoTrack(stream)?.readyState || null,
      applyResult: factor ?? actualZoom ?? requestedZoom,
    });
    return {
      stream,
      detected,
      deviceId: getCurrentTrackSettings(stream).deviceId || mainId,
      lensType: "main",
      zoomMode: WIDE_ZOOM_MODE,
      currentZoom: factor || roundZoomFactor(actualZoom ?? requestedZoom),
      digitalZoom: actualZoom ?? requestedZoom,
      ultraFactor: factor || roundZoomFactor(actualZoom ?? requestedZoom),
      switchedDevice: false,
      selectionPath: "logical-zoom",
    };
  } catch (error) {
    logCameraPtz({
      path: "logical-zoom",
      applyResult: "error",
      errorName: error?.name || null,
      errorMessage: error?.message || String(error),
    });
    return null;
  }
}

/**
 * Open one rear camera by exact deviceId (sequential multi-cam only).
 * Optional zoom:true for PTZ permission — never min/max/exact on zoom in GUM.
 * @param {string} deviceId
 * @param {{ requestZoom?: boolean }} [opts]
 * @returns {Promise<MediaStream|null>}
 */
async function openRearDeviceExact(deviceId, opts = {}) {
  if (!deviceId || !navigator.mediaDevices?.getUserMedia) return null;
  const supportedZoom = canRequestBrowserZoomControl();
  const quality = getCameraPreviewConstraints(
    CONFIG?.app?.camera?.constraints?.default || {},
  );
  const video = {
    deviceId: { exact: deviceId },
    ...quality,
  };
  try {
    return await openAndUpgrade(video, {
      requestZoomControl: opts.requestZoom !== false && supportedZoom,
    });
  } catch {
    try {
      // Bare exact — max compatibility when quality constraints fail
      return await openAndUpgrade(
        { deviceId: { exact: deviceId } },
        {
          requestZoomControl: opts.requestZoom !== false && supportedZoom,
        },
      );
    } catch {
      return null;
    }
  }
}

/**
 * Apply capabilities.zoom.min when min < 0.98 (logical ultra on this track).
 * Never hard-code 0.5 — S25 FE may report 0.6. On failure keep stream live.
 * @param {MediaStream} stream
 * @returns {Promise<{ ok: boolean, requested: number|null, actual: number|null }>}
 */
async function tryApplyTrackZoomMin(stream) {
  const track = getActiveVideoTrack(stream);
  if (!track || track.readyState !== "live") {
    return { ok: false, requested: null, actual: null };
  }
  const caps = track.getCapabilities?.() || {};
  const parsed = parseZoomCapability(caps.zoom);
  if (!parsed || Number(parsed.min) >= 0.98) {
    return {
      ok: false,
      requested: null,
      actual: getCurrentTrackSettings(stream)?.zoom ?? null,
    };
  }
  const requested = Number(parsed.min);
  if (!isPageVisibleForPtz()) {
    const vis = await waitForPageVisible(6000);
    if (!vis) {
      return {
        ok: false,
        requested,
        actual: getCurrentTrackSettings(stream)?.zoom ?? null,
      };
    }
  }
  try {
    await track.applyConstraints({ advanced: [{ zoom: requested }] });
  } catch {
    try {
      await track.applyConstraints(/** @type {MediaTrackConstraints} */ ({
        zoom: requested,
      }));
    } catch {
      // Keep stream alive — fall through to physical / next device
      return {
        ok: false,
        requested,
        actual: getCurrentTrackSettings(stream)?.zoom ?? null,
      };
    }
  }
  await new Promise((r) => setTimeout(r, 90));
  if (track.readyState !== "live") {
    return { ok: false, requested, actual: null };
  }
  const actual = getCurrentTrackSettings(stream)?.zoom ?? null;
  const ok =
    typeof actual === "number" &&
    Number.isFinite(actual) &&
    (isUltraZoomValue(actual) ||
      Math.abs(actual - requested) <=
        Math.max(0.15, (parsed.step || 0.1) * 2));
  return { ok, requested, actual };
}

/**
 * Sequential rear probe — permission → enumerate → open one device at a time.
 * W3C multi-rear: no stable focalLength; measure zoom.min / keep physical list.
 * Stops previous trial stream before opening the next. Never returns ended best.
 *
 * @param {{
 *   oldStream?: MediaStream|null,
 *   videoEl?: HTMLVideoElement|null,
 *   preferredId?: string|null,
 *   stopOld?: boolean,
 * }} [options]
 * @returns {Promise<{
 *   rows: object[],
 *   rear: MediaDeviceInfo[],
 *   best: object|null,
 *   logicalBest: object|null,
 * }>}
 */
export async function probeRearCamerasSequential(options = {}) {
  const {
    oldStream = null,
    videoEl = null,
    preferredId = null,
    stopOld = true,
  } = options;

  const rear = await listAllRearVideoInputs();
  const rows = [];
  lastRearProbeReport = rows;

  if (stopOld && oldStream) {
    try {
      clearTrackZoomCache(oldStream);
      stopCurrentCamera(oldStream, videoEl);
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

  // Order: preferred first, then remaining (do not drop tele/macro forever)
  const ordered = [];
  if (preferredId && rear.some((d) => d.deviceId === preferredId)) {
    ordered.push(preferredId);
  }
  for (const d of rear) {
    if (d?.deviceId && !ordered.includes(d.deviceId)) ordered.push(d.deviceId);
  }

  /** @type {object|null} */
  let best = null;
  /** @type {object|null} */
  let logicalBest = null;

  for (const id of ordered) {
    const deviceInfo = rear.find((d) => d.deviceId === id) || null;

    // Always free previous trial before next open (Samsung single camera slot)
    if (best?.stream && isLiveVideoStream(best.stream)) {
      // Keep best until we know next is better — stop if we're about to open another
    }
    // Stop non-winning live stream from previous iteration
    // (best is updated after compare; hold "trial" separately)
    let trialStream = null;
    try {
      // Brief HAL release between exclusive camera opens (Android single-slot;
      // also helps Safari / desktop when switching deviceId exact).
      await new Promise((r) =>
        setTimeout(r, ordered.length > 2 ? 140 : 100),
      );
      // zoom:true only when getSupportedConstraints().zoom — openAndUpgrade handles it
      trialStream = await openRearDeviceExact(id, { requestZoom: true });
      if (!isLiveVideoStream(trialStream)) {
        if (trialStream) stopCurrentCamera(trialStream);
        const failRow = {
          label: deviceInfo?.label || "",
          deviceId: id,
          groupId: deviceInfo?.groupId || null,
          capabilitiesZoom: null,
          settingsZoom: null,
          width: null,
          height: null,
          facingMode: null,
          trackState: "ended",
          path: "open-failed",
          appliedZoom: null,
        };
        rows.push(failRow);
        logCameraPtz({
          path: "sequential-probe",
          ...failRow,
          applyResult: "open-failed",
        });
        continue;
      }

      const snap = snapshotTrackCameraInfo(trialStream, deviceInfo);
      let appliedZoom = null;
      let applyOk = false;
      const zoomMin = snap.capabilitiesZoom?.min;
      if (
        snap.capabilitiesZoom &&
        typeof zoomMin === "number" &&
        zoomMin < 0.98
      ) {
        const applied = await tryApplyTrackZoomMin(trialStream);
        applyOk = applied.ok;
        appliedZoom = applied.actual ?? applied.requested;
        // Re-snapshot after apply
        const after = snapshotTrackCameraInfo(trialStream, deviceInfo);
        Object.assign(snap, after);
        snap.appliedZoom = appliedZoom;
        snap.applyOk = applyOk;
      } else {
        snap.appliedZoom = null;
        snap.applyOk = false;
      }

      if (!isLiveVideoStream(trialStream)) {
        rows.push({
          ...snap,
          trackState: "ended",
          path: "died-after-apply",
        });
        logCameraPtz({
          path: "sequential-probe",
          ...snap,
          applyResult: "track-ended",
        });
        trialStream = null;
        continue;
      }

      const row = {
        ...snap,
        path: applyOk
          ? "logical-zoom"
          : snap.capabilitiesZoom?.min != null &&
              Number(snap.capabilitiesZoom.min) < 0.98
            ? "logical-apply-failed"
            : "physical-device",
      };
      rows.push(row);
      logCameraPtz({
        path: "sequential-probe",
        label: row.label,
        selectedDeviceId: row.deviceId,
        groupId: row.groupId,
        zoomCapabilities: row.capabilitiesZoom,
        zoomAfter: row.settingsZoom,
        width: row.width,
        height: row.height,
        facingMode: row.facingMode,
        trackState: row.trackState,
        applyResult: row.path,
        requestedZoom: appliedZoom,
      });

      const entry = {
        stream: trialStream,
        deviceId: row.deviceId || id,
        deviceInfo,
        snap: row,
        zoomMin:
          typeof row.capabilitiesZoom?.min === "number"
            ? row.capabilitiesZoom.min
            : 99,
        settingsZoom: row.settingsZoom,
        logicalUltra: Boolean(
          applyOk ||
            (typeof row.settingsZoom === "number" &&
              isUltraZoomValue(row.settingsZoom)) ||
            (typeof row.capabilitiesZoom?.min === "number" &&
              row.capabilitiesZoom.min < 0.98),
        ),
      };

      // Prefer lowest zoom.min among logical-ultra tracks
      if (entry.logicalUltra) {
        if (
          !logicalBest ||
          entry.zoomMin < logicalBest.zoomMin - 0.01 ||
          (Math.abs(entry.zoomMin - logicalBest.zoomMin) < 0.01 &&
            id === preferredId)
        ) {
          if (
            logicalBest?.stream &&
            logicalBest.stream !== trialStream &&
            isLiveVideoStream(logicalBest.stream)
          ) {
            stopCurrentCamera(logicalBest.stream);
          }
          if (
            best?.stream &&
            best.stream !== trialStream &&
            best.stream !== logicalBest?.stream &&
            isLiveVideoStream(best.stream)
          ) {
            stopCurrentCamera(best.stream);
          }
          logicalBest = entry;
          best = entry;
          trialStream = null; // ownership transferred
        }
      } else if (
        !best ||
        (!best.logicalUltra &&
          (id === preferredId ||
            isConfidentUltraLabel(deviceInfo?.label || "") ||
            parseCamera2Index(deviceInfo?.label || "") === 2))
      ) {
        // Physical candidate when no logical ultra yet — keep preferred / camera2-2
        if (
          !best?.logicalUltra &&
          (!best ||
            id === preferredId ||
            isConfidentUltraLabel(deviceInfo?.label || "") ||
            parseCamera2Index(deviceInfo?.label || "") === 2)
        ) {
          if (
            best?.stream &&
            best.stream !== trialStream &&
            isLiveVideoStream(best.stream)
          ) {
            stopCurrentCamera(best.stream);
          }
          best = entry;
          trialStream = null;
        }
      }

      // Discard non-winning trial
      if (trialStream && isLiveVideoStream(trialStream)) {
        stopCurrentCamera(trialStream);
        trialStream = null;
      }
    } catch (error) {
      if (trialStream) {
        try {
          stopCurrentCamera(trialStream);
        } catch {
          /* ignore */
        }
      }
      const errRow = {
        label: deviceInfo?.label || "",
        deviceId: id,
        groupId: deviceInfo?.groupId || null,
        capabilitiesZoom: null,
        settingsZoom: null,
        width: null,
        height: null,
        facingMode: null,
        trackState: "error",
        path: "error",
        errorName: error?.name || null,
        errorMessage: error?.message || String(error),
      };
      rows.push(errRow);
      logCameraPtz({
        path: "sequential-probe",
        ...errRow,
        applyResult: "error",
      });
    }
  }

  lastRearProbeReport = rows.slice();

  // Ensure best is still live
  if (best && !isLiveVideoStream(best.stream)) {
    best = null;
  }
  if (logicalBest && !isLiveVideoStream(logicalBest.stream)) {
    logicalBest = null;
  }

  return { rows, rear, best, logicalBest };
}

/**
 * Open a specific rear lens deviceId (physical multi-cam).
 * Samsung: stop old → clear srcObject → wait 150–300ms → open exact id.
 * Never parallel getUserMedia. Never return ended tracks.
 */
async function openPhysicalUltraDevice(id, oldStream, videoEl) {
  const supportedZoom = canRequestBrowserZoomControl();
  const quality = getCameraPreviewConstraints(
    CONFIG?.app?.camera?.constraints?.default || {},
  );

  const openExact = async () => {
    // deviceId exact + optional zoom:true only (no undefined keys)
    const video = {
      deviceId: { exact: id },
      ...quality,
    };
    return openAndUpgrade(video, { requestZoomControl: supportedZoom });
  };

  // Free previous stream first (Samsung Camera2 single-slot)
  if (oldStream) {
    try {
      clearTrackZoomCache(oldStream);
      stopCurrentCamera(oldStream, videoEl);
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

  let stream = null;
  let lastError = null;
  for (const releaseDelay of [160, 280]) {
    await new Promise((r) => setTimeout(r, releaseDelay));
    try {
      stream = await openExact();
      if (stream && isLiveVideoStream(stream)) break;
      if (stream) {
        stopCurrentCamera(stream);
        stream = null;
      }
    } catch (error) {
      lastError = error;
      logCameraPtz({
        path: "physical-device",
        selectedDeviceId: id,
        applyResult: "error",
        errorName: error?.name || null,
        errorMessage: error?.message || String(error),
      });
    }
  }

  if (!stream) {
    logCameraPtz({
      path: "physical-device",
      selectedDeviceId: id,
      applyResult: "failed",
      errorName: lastError?.name || null,
      errorMessage: lastError?.message || null,
    });
    return null;
  }

  const openedId = getCurrentTrackSettings(stream)?.deviceId || null;
  if (openedId && openedId !== id) {
    // Browser silently remapped — try bare exact once more
    try {
      stopCurrentCamera(stream);
      if (videoEl) {
        try {
          videoEl.srcObject = null;
        } catch {
          /* ignore */
        }
      }
      await new Promise((r) => setTimeout(r, 180));
      const bare = { deviceId: { exact: id } };
      const stream2 = await openAndUpgrade(bare, {
        requestZoomControl: supportedZoom,
      });
      if (isLiveVideoStream(stream2)) {
        logCameraPtz({
          path: "physical-device",
          selectedDeviceId: id,
          zoomAfter: getCurrentTrackSettings(stream2)?.zoom ?? null,
          trackState: getActiveVideoTrack(stream2)?.readyState || null,
          applyResult: "bare-exact-ok",
        });
        return stream2;
      }
      stopCurrentCamera(stream2);
    } catch (error) {
      logCameraPtz({
        path: "physical-device",
        selectedDeviceId: id,
        applyResult: "wrong-device",
        errorName: error?.name || null,
        errorMessage: error?.message || String(error),
      });
    }
    return null;
  }

  logCameraPtz({
    path: "physical-device",
    selectedDeviceId: openedId || id,
    zoomAfter: getCurrentTrackSettings(stream)?.zoom ?? null,
    trackState: getActiveVideoTrack(stream)?.readyState || null,
    applyResult: "ok",
  });
  return stream;
}

/**
 * Switch to the **widest** rear FOV this device can offer.
 *
 * Does NOT hardcode 0.5:
 *  - Prefer physical ultra candidates (labels / multi-rear structure)
 *  - After open, park at track.getCapabilities().zoom.min
 *  - Among candidates that open, keep the one with lowest zoom.min
 *  - Else digital park on main when min < ~1
 *
 * Order (critical for Samsung multi-cam HAL — one stream at a time):
 *  1) Logical/current track at its real minZoom (native-like smooth switch)
 *  2) One preferred/classified physical candidate at a time
 *  3) Re-open main + digital if every physical open failed
 *
 * @deprecated name switchToUltraWide05 — use switchToWidestLens
 */
export async function switchToUltraWide05(options = {}) {
  return switchToWidestLens(options);
}

/**
 * Switch to widest FOV available on this device.
 *
 * Two independent paths (do not conflate):
 *  A) PTZ/logical zoom — applyConstraints zoom.min when min < 0.98 (e.g. 0.6 on S25 FE)
 *  B) Physical deviceId — sequential open of every rear videoinput
 *
 * Never uses focalLength (W3C proposal only; not stable in browsers).
 * Never hard-codes 0.5x. Never returns ended tracks.
 *
 * @param {{ oldStream?: MediaStream|null, videoEl?: HTMLVideoElement|null, detected?: object|null }} [options]
 */
export async function switchToWidestLens(options = {}) {
  const { oldStream = null, videoEl = null, detected: detIn = null } = options;

  // Permission → enumerateDevices (labels + deviceIds)
  const rearList = await listAllRearVideoInputs();
  let detected = detIn || (await detectCameraDevices({ probe: false }));
  // Merge full rear list (never drop unlabeled / non-"ultra" rears)
  detected = {
    ...detected,
    rear: rearList,
    rearOptions: rearList.slice(),
    needsManualLensPick:
      Boolean(detected?.needsManualLensPick) || rearList.length >= 2,
  };

  const rearCount = rearList.length;
  const rearLabels = rearList.map((d) => d?.label || "(unlabeled)");
  const mainId = detected.main?.deviceId || rearList[0]?.deviceId || null;
  const preferredWideId = getPreferredWideCameraId(rearList);
  const supportedZoom = canRequestBrowserZoomControl();
  const liveRange = readZoomRange(oldStream);

  logCameraPtz({
    path: "switch-widest-start",
    supportedZoom,
    rearCameraCount: rearCount,
    cameraLabels: rearLabels,
    zoomCapabilities: liveRange.supported
      ? {
          min: liveRange.minZoom,
          max: liveRange.maxZoom,
          step: liveRange.zoomStep,
        }
      : null,
    zoomBefore: getCurrentTrackSettings(oldStream)?.zoom ?? null,
    selectedDeviceId: preferredWideId || null,
    trackState: getActiveVideoTrack(oldStream)?.readyState || null,
    applyResult: "start",
  });

  let liveStream = isLiveVideoStream(oldStream) ? oldStream : null;

  // ── A) Logical PTZ on current live track (no device switch) ──
  const logicalWide = await tryDigitalUltraWide(
    liveStream,
    detected,
    mainId,
  );
  if (logicalWide && isLiveVideoStream(logicalWide.stream)) {
    return {
      ...logicalWide,
      selectionPath: "logical-zoom",
      probeRows: getLastRearProbeReport(),
      forceLensPicker: rearCount >= 2,
    };
  }

  // ── B) Sequential physical probe of ALL rear videoinputs ──
  // Stops old stream; opens deviceId exact one-by-one; applies zoom.min when < 0.98
  const probe = await probeRearCamerasSequential({
    oldStream: liveStream,
    videoEl,
    preferredId: preferredWideId,
    stopOld: true,
  });
  liveStream = null;

  const winner = probe.logicalBest || probe.best;
  if (winner && isLiveVideoStream(winner.stream)) {
    const stream = winner.stream;
    const openedId =
      getCurrentTrackSettings(stream)?.deviceId || winner.deviceId;
    const settingsZ = getCurrentTrackSettings(stream)?.zoom;
    const factor = resolveUltraWideFactor(
      stream,
      detected,
      typeof settingsZ === "number" ? settingsZ : winner.settingsZoom,
    );
    const isLogical = Boolean(winner.logicalUltra);
    // Remember user-preferred or confirmed logical ultra device
    if (preferredWideId === openedId || isLogical) {
      rememberPreferredWideCameraId(openedId);
    }

    logCameraPtz({
      path: isLogical ? "logical-zoom" : "physical-device",
      rearCameraCount: rearCount,
      cameraLabels: rearLabels,
      selectedDeviceId: openedId,
      zoomCapabilities: winner.snap?.capabilitiesZoom || null,
      zoomAfter: settingsZ ?? null,
      trackState: getActiveVideoTrack(stream)?.readyState || null,
      applyResult: factor ?? settingsZ ?? "live",
    });

    // Success if logical ultra OR multi-rear physical pick (user can refine via Lens)
    if (isLogical || rearCount >= 2) {
      return {
        stream,
        detected: {
          ...detected,
          rear: probe.rear,
          rearOptions: probe.rear,
        },
        deviceId: openedId,
        lensType: isLogical ? "main" : "ultrawide",
        zoomMode: WIDE_ZOOM_MODE,
        currentZoom:
          factor != null
            ? factor
            : typeof settingsZ === "number" && isUltraZoomValue(settingsZ)
              ? roundZoomFactor(settingsZ)
              : null,
        digitalZoom: settingsZ ?? null,
        ultraFactor: factor,
        switchedDevice: true,
        selectionPath: isLogical
          ? "logical-zoom"
          : preferredWideId === openedId
            ? "remembered-device"
            : "physical-device",
        probeRows: probe.rows,
        forceLensPicker: rearCount >= 2 && !isLogical,
      };
    }
  }

  // ── C) Restore a live main stream if probe left nothing ──
  let stream =
    winner && isLiveVideoStream(winner.stream) ? winner.stream : null;
  if (!stream) {
    try {
      stream = await startCameraByDeviceId(mainId, {
        facingMode: "environment",
        highRes: false,
        preferDeviceId: Boolean(mainId),
      });
      if (!isLiveVideoStream(stream)) {
        stopCurrentCamera(stream);
        stream = null;
      }
    } catch (e) {
      logCameraPtz({
        path: "unsupported",
        applyResult: "open-main-failed",
        errorName: e?.name || null,
        errorMessage: e?.message || String(e),
      });
      return {
        unavailable: true,
        reason: "open-failed",
        detected,
        rearCount,
        probeRows: probe.rows,
        message: BROWSER_HIDES_ULTRAWIDE_MSG,
      };
    }
  }

  const digitalRetry = await tryDigitalUltraWide(stream, detected, mainId);
  if (digitalRetry && isLiveVideoStream(digitalRetry.stream)) {
    return {
      ...digitalRetry,
      probeRows: probe.rows,
      forceLensPicker: rearCount >= 2,
    };
  }

  const range = readZoomRange(stream);
  const noLogicalWide =
    !range.supported || Number(range.minZoom) >= 0.98;
  const reason =
    rearCount <= 1 && noLogicalWide
      ? "browser-hides-ultrawide"
      : rearCount >= 2
        ? "needs-manual-lens"
        : "ultra-unavailable";

  logCameraPtz({
    path: "unsupported",
    supportedZoom,
    rearCameraCount: rearCount,
    cameraLabels: rearLabels,
    zoomCapabilities: range.supported
      ? {
          min: range.minZoom,
          max: range.maxZoom,
          step: range.zoomStep,
        }
      : null,
    zoomAfter: getCurrentTrackSettings(stream)?.zoom ?? null,
    trackState: getActiveVideoTrack(stream)?.readyState || null,
    applyResult: reason,
  });

  return {
    unavailable: true,
    reason,
    detected: {
      ...detected,
      rear: probe.rear?.length ? probe.rear : rearList,
      rearOptions: probe.rear?.length ? probe.rear : rearList,
      needsManualLensPick: rearCount >= 2,
    },
    rearCount,
    stream: isLiveVideoStream(stream) ? stream : null,
    probeRows: probe.rows,
    forceLensPicker: rearCount >= 2,
    message: BROWSER_HIDES_ULTRAWIDE_MSG,
  };
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
    // Always expose full rear list — manual pick when confidence is low
    rearOptions: d.rearOptions || d.rear || [],
    ultraConfidence: d.ultraConfidence || "none",
    needsManualLensPick: Boolean(d.needsManualLensPick),
    ultraRanked: d.ultraRanked || [],
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
 * Chụp frame cuối của video → dataURL (freeze khi flip, tránh màn đen).
 */
export function captureVideoFreezeFrame(videoEl) {
  if (!videoEl || videoEl.readyState < 2) return null;
  const w = videoEl.videoWidth || 0;
  const h = videoEl.videoHeight || 0;
  if (w < 2 || h < 2) return null;
  try {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(videoEl, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

/**
 * Open front camera (facingMode user).
 * stopFirst=true (mặc định khi flip): stop cam cũ rồi mở mới — bắt buộc trên
 * nhiều Android (chỉ 1 cam hardware). Caller nên freeze frame trước.
 */
export async function startFrontCamera(options = {}) {
  const {
    oldStream = null,
    videoEl = null,
    deviceId = null,
    fast = true,
    // Flip: stop trước để mở cam kia ngay (hardware single-lens)
    stopFirst = true,
  } = options;

  if (stopFirst && oldStream) {
    clearTrackZoomCache(oldStream);
    stopCurrentCamera(oldStream, null);
  }

  // Luôn facingMode user — KHÔNG dùng deviceId (tránh đảo cam sau/trước)
  const stream = await openCameraByFacing("user", {
    fast: true,
    deviceId: null,
  });

  if (!stopFirst && oldStream && oldStream !== stream) {
    clearTrackZoomCache(oldStream);
    stopCurrentCamera(oldStream, null);
  }

  // Zoom 1x nền — không await
  resetFrontCameraZoom(stream).catch(() => {});
  const caps = refreshFrontCameraZoomCapabilities(stream);
  const settings = getCurrentTrackSettings(stream);
  const actualFacing = settings.facingMode || "user";

  return {
    stream,
    deviceId: settings.deviceId || deviceId,
    facingMode: actualFacing,
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
