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
  isPhoneLikeCameraEnv,
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
  if (meta) deviceProbeCache.set(deviceId, meta);
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
 * Fire-and-forget capability probes — updates probe cache without blocking UI.
 * Safe to call after first camera list is shown.
 */
export function scheduleCameraCapabilityProbe(detected) {
  if (!detected?.rear || detected.rear.length < 2) return;
  if (isConfidentUltraLabel(detected.ultrawide?.label || "")) return;
  // Don't await — warm cache for next ultra switch / reclassify
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
 * Sorted by score so 0.5–0.9 / unlabeled devices still get a chance.
 * Never omits a usable non-main rear (except clear tele labels).
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
    .filter((d) => d.deviceId !== mainId && d.deviceId !== teleId)
    .filter((d) => !isTeleLabel(d.label || ""))
    .map((device) => {
      let score = scoreUltraWideCandidate(device, {
        mainId,
        teleId,
        rearIndex: rearCameras.findIndex((x) => x.deviceId === device.deviceId),
        rearTotal: rearCameras.length,
        probe: deviceProbeCache.get(device.deviceId) || null,
      });
      // Samsung / Android camera2 2 = ultra (S25 FE, A-series, …)
      const idx = parseCamera2Index(device.label || "");
      if (idx === 2) score += 80;
      else if (idx != null && idx > 2) score -= 20;
      return { device, score };
    })
    .sort((a, b) => b.score - a.score);

  // Always expose every non-main/non-tele rear as a candidate (manual + trial open)
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
    // Deduplicate concurrent enrich calls
    if (!probeInFlight) {
      probeInFlight = Promise.all(
        toProbe.map((id) => probeDeviceCapabilities(id)),
      ).finally(() => {
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

/** getUserMedia OK → bump quality if track allows (safe no-op on fail) */
async function openAndUpgrade(videoConstraints) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: videoConstraints,
    audio: false,
  });
  try {
    await upgradeStreamQuality(stream);
  } catch {
    /* keep stream */
  }
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
  const tryOpen = (video) => openAndUpgrade(video);

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
    return await openAndUpgrade({ facingMode: want });
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

  const tryOpen = (video) => openAndUpgrade(video);

  const want = facingMode === "user" ? "user" : "environment";

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
  if (!track || track.readyState === "ended") return false;

  let cached = trackZoomCache.get(track);
  if (!cached) {
    const caps = getCurrentTrackCapabilities(stream);
    if (!caps?.zoom) return false;
    cached = {
      min: caps.zoom.min ?? 1,
      max: caps.zoom.max ?? 1,
      step: caps.zoom.step ?? 0.1,
      last: null,
    };
    trackZoomCache.set(track, cached);
  }

  let next = clampZoom(value, cached.min, cached.max);
  // Snap theo step (Samsung hay báo step 0.1 — 0.6 phải khớp)
  const step = Number(cached.step);
  if (Number.isFinite(step) && step > 0 && step < 1) {
    const snapped =
      Math.round((next - cached.min) / step) * step + cached.min;
    next = clampZoom(snapped, cached.min, cached.max);
    // Làm tròn float lỗi 0.6000001
    next = Math.round(next * 1000) / 1000;
  }

  // Bỏ qua apply nếu gần như không đổi — giảm jank
  if (cached.last != null && Math.abs(cached.last - next) < 0.01) {
    return cached.last;
  }

  const attempts = [
    { advanced: [{ zoom: next }] },
    { zoom: next },
    // Một số WebView Samsung chỉ nhận ideal
    { advanced: [{ zoom: { ideal: next } }] },
  ];

  for (const c of attempts) {
    try {
      await track.applyConstraints(c);
      // Xác nhận settings thật (Samsung đôi khi nuốt constraint im lặng)
      const applied = getCurrentTrackSettings(stream)?.zoom;
      cached.last =
        typeof applied === "number" && Number.isFinite(applied) ? applied : next;
      return cached.last;
    } catch {
      /* thử format tiếp */
    }
  }
  return false;
}

/** Clear zoom cache when stream stops (optional) */
export function clearTrackZoomCache(stream) {
  const track = getActiveVideoTrack(stream);
  if (track) trackZoomCache.delete(track);
}

/** Format badge text: 0.5x, 0.6x, 1x, 1.4x, 2x… */
export function updateZoomBadge(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "1x";
  if (Math.abs(n - 1) < 0.05) return "1x";
  // góc rộng: hiện 1 chữ số thập phân (0.5 / 0.6 / 0.7)
  if (n > 0.2 && n < 0.95) {
    return `${Number(n.toFixed(1))}x`;
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
 * Nhãn nút zoom — ultra chỉ hiện số KHI đã đọc từ camera (ultraFactor).
 * Chưa đo được → "UW" (không bịa 0.5/0.6).
 */
export function formatZoomModeLabel(mode, ultraFactor = null) {
  if (
    mode === "0.5x" ||
    mode === "0.6x" ||
    mode === "0.7x" ||
    mode === "0.8x" ||
    mode === "0.9x" ||
    mode === "wide"
  ) {
    const f = Number(ultraFactor);
    if (isUltraZoomValue(f)) {
      const r = roundZoomFactor(f);
      return r != null ? String(r) : "UW";
    }
    // Lens ultra vật lý nhưng API không trả minZoom — không đoán hãng
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

  // Digital wide on the *current* track (logical multi-cam) is a zoom FEATURE,
  // not classification of a separate ultra deviceId. Safe to enable the pill
  // when the live track exposes minZoom in the wide band — still never used
  // alone to assign `detected.ultrawide`.
  const digitalWideRange =
    range.supported && isUltraZoomValue(range.minZoom);

  // Enable UW pill: classified lens · multi-rear candidates · live digital range
  // (display number still comes from live factor / "UW", never hard-coded 0.5)
  const canWide =
    hasClassifiedUltra ||
    (hasUltraCandidates && multiRear) ||
    digitalWideRange ||
    conf === "high" ||
    conf === "medium";

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

  // Ultra-wide pill — any factor 0.5–0.9 (internal mode key stays "0.5x")
  if (
    m === "0.5x" ||
    m === "0.5" ||
    m === "0.6x" ||
    m === "0.6" ||
    m === "0.7x" ||
    m === "0.7" ||
    m === "0.8x" ||
    m === "0.8" ||
    m === "0.9x" ||
    m === "0.9" ||
    m === "wide" ||
    m === "uw"
  ) {
    // Chỉ số từ capabilities.zoom.min của stream hiện tại
    const factor = resolveUltraWideFactor(stream, detected, null);

    // 1) Ultra vật lý
    if (ultraId) {
      return {
        deviceId: ultraId,
        digitalZoom: 1,
        displayZoom: factor,
        lensType: "ultrawide",
        mode: "0.5x",
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
        digitalZoom: 1,
        displayZoom: factor,
        lensType: "ultrawide",
        mode: "0.5x",
        ultraFactor: factor,
      };
    }
    // 3) Digital: minZoom THẬT từ track — 0.5 / 0.6 / 0.7 / 0.8 / 0.9
    if (range.supported && isUltraZoomValue(range.minZoom)) {
      const z = range.minZoom;
      const f = roundZoomFactor(z);
      return {
        deviceId: mainId,
        digitalZoom: z,
        displayZoom: f,
        lensType: "main",
        mode: "0.5x",
        ultraFactor: f,
      };
    }
    // Không hỗ trợ
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
 */
export function mapDisplayZoomToLens(displayZoom, detected, stream) {
  const z = Number(displayZoom) || 1;
  const mainId = detected?.main?.deviceId || detected?.rear?.[0]?.deviceId || null;
  const ultraId = detected?.ultrawide?.deviceId || null;
  const teleId = detected?.telephoto?.deviceId || null;
  const range = readZoomRange(stream);

  // ── wide band: ultra lens / digital min từ getCapabilities ──
  if (z < 0.92) {
    const factor = resolveUltraWideFactor(stream, detected, null);

    if (ultraId) {
      return {
        deviceId: ultraId,
        digitalZoom: 1,
        displayZoom: factor != null ? factor : z,
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

/**
 * Áp digital minZoom (0.5 / 0.6 / 0.7) trên stream còn live.
 * @returns {Promise<object|null>}
 */
async function tryDigitalUltraWide(stream, detected, mainId) {
  if (!stream) return null;
  const track = getActiveVideoTrack(stream);
  if (!track || track.readyState === "ended") return null;
  if (!supportsHardwareZoom(stream)) return null;

  const range = readZoomRange(stream);
  // minZoom thật của máy: 0.5 / 0.6 / 0.7 / 0.8 / 0.9… (không ép 0.5)
  if (!isUltraZoomValue(range.minZoom)) return null;

  const z = range.minZoom;
  try {
    clearTrackZoomCache(stream);
    const applied = await applyCameraZoom(stream, z);
    if (applied === false) return null;
    const settingsZ = getCurrentTrackSettings(stream)?.zoom;
    const ok =
      typeof settingsZ !== "number" ||
      settingsZ <= z + 0.15 ||
      Math.abs(settingsZ - z) < 0.2;
    if (!ok && typeof settingsZ === "number" && settingsZ >= 0.95) {
      return null;
    }
    const factor = resolveUltraWideFactor(
      stream,
      detected,
      typeof settingsZ === "number" && settingsZ < 0.95 ? settingsZ : applied || z,
    );
    return {
      stream,
      detected,
      deviceId: getCurrentTrackSettings(stream).deviceId || mainId,
      lensType: "main",
      zoomMode: "0.5x",
      currentZoom: factor || roundZoomFactor(z),
      digitalZoom: applied || z,
      ultraFactor: factor || roundZoomFactor(z),
      switchedDevice: false,
    };
  } catch {
    return null;
  }
}

/**
 * Open a specific rear lens deviceId for ultra-wide.
 * Android/Samsung often allow ONLY ONE camera stream — open-new-first fails
 * while main is live. Strategy:
 *  1) Try open-new-first (iOS / multi-stream browsers)
 *  2) On failure: stop old → open exact deviceId (Samsung S25 FE path)
 */
async function openPhysicalUltraDevice(id, oldStream, videoEl) {
  const openExact = () =>
    startCameraByDeviceId(id, {
      facingMode: "environment",
      highRes: false,
      preferDeviceId: true,
      forceDeviceId: true,
      facingOnly: false,
    });

  // Path A: keep old until new is ready (smoother where multi-cam concurrent OK)
  try {
    const stream = await openExact();
    const openedId = getCurrentTrackSettings(stream)?.deviceId || null;
    // Browser silently gave us main instead of ultra
    if (openedId && openedId !== id) {
      stopCurrentCamera(stream);
      throw new Error("wrong-device-opened");
    }
    if (oldStream && oldStream !== stream) {
      clearTrackZoomCache(oldStream);
      stopCurrentCamera(oldStream, videoEl);
    }
    return stream;
  } catch (e1) {
    // Path B: Samsung / many Android — must free the main camera first
    try {
      if (oldStream) {
        clearTrackZoomCache(oldStream);
        stopCurrentCamera(oldStream, videoEl);
      }
      // Brief yield so HAL releases camera2 0 before opening camera2 2
      await new Promise((r) => setTimeout(r, 80));
      const stream = await openExact();
      const openedId = getCurrentTrackSettings(stream)?.deviceId || null;
      if (openedId && openedId !== id) {
        // Last resort: bare exact without quality extras
        try {
          stopCurrentCamera(stream);
          const stream2 = await openAndUpgrade({
            deviceId: { exact: id },
          });
          return stream2;
        } catch {
          /* fall through */
        }
      }
      return stream;
    } catch (e2) {
      console.warn(
        "[ultra] physical open failed",
        id,
        e1?.message,
        e2?.message,
      );
      return null;
    }
  }
}

/**
 * Switch góc siêu rộng — factor thật (0.5 / 0.6 Samsung / 0.7).
 *
 * Order (critical for S25 FE):
 *  1) Physical multi-rear candidates FIRST (camera2 2, …) — Samsung often
 *     does NOT expose minZoom&lt;1 on the main track; concurrent open fails.
 *  2) Digital minZoom on current/main stream (logical multi-cam)
 *  3) Re-open main + digital if stream died mid-switch
 */
export async function switchToUltraWide05(options = {}) {
  const { oldStream = null, videoEl = null, detected: detIn = null } = options;
  let detected = detIn || (await detectCameraDevices({ probe: false }));
  // Re-classify labels only (no getUserMedia probe) — probing steals the
  // single Android camera slot and breaks the subsequent ultra open.
  if (!detected?.ultrawide?.deviceId && (detected?.rear?.length || 0) >= 2) {
    try {
      const devices =
        detected.all?.length > 0
          ? detected.all
          : await ensureLabeledVideoDevices();
      const refreshed = detectRearCameras(devices);
      detected = { ...detected, ...refreshed };
    } catch {
      /* keep */
    }
  }

  const mainId = detected.main?.deviceId || detected.rear?.[0]?.deviceId || null;
  const ultraId = detected.ultrawide?.deviceId || null;
  const candidates = [
    ultraId,
    ...listUltraWideCandidates(
      detected.rear || [],
      detected.main || null,
      detected.telephoto || null,
    ),
  ].filter((id, i, arr) => id && arr.indexOf(id) === i && id !== mainId);

  const multiPhysical = candidates.length > 0;
  let lastOpened = null;
  let liveStream = oldStream;

  // 1) Physical ultra FIRST when we have a separate rear deviceId
  //    (S25 FE camera2 2 — digital zoom alone never changes FOV here)
  if (multiPhysical) {
    for (const id of candidates) {
      try {
        const stream = await openPhysicalUltraDevice(id, liveStream, videoEl);
        if (!stream) continue;
        liveStream = stream;
        lastOpened = stream;

        if (supportsHardwareZoom(stream)) {
          try {
            const range = readZoomRange(stream);
            const z =
              range.minZoom > 0.15 && range.minZoom < 0.95
                ? range.minZoom
                : range.minZoom <= 1 && range.maxZoom >= 1
                  ? 1
                  : range.minZoom;
            await applyCameraZoom(stream, z);
          } catch {
            /* ignore */
          }
        }

        const appliedZ = getCurrentTrackSettings(stream)?.zoom;
        const factor = resolveUltraWideFactor(
          stream,
          detected,
          typeof appliedZ === "number" ? appliedZ : null,
        );
        const openedId = getCurrentTrackSettings(stream)?.deviceId || id;
        return {
          stream,
          detected,
          deviceId: openedId,
          lensType: "ultrawide",
          zoomMode: "0.5x",
          currentZoom: factor != null ? factor : 1,
          digitalZoom: 1,
          ultraFactor: factor,
          switchedDevice: true,
        };
      } catch (e) {
        console.warn("[ultra] open candidate failed", id, e?.message);
      }
    }
  }

  // 2) Digital minZoom on remaining live stream (logical multi-cam)
  const digitalFirst = await tryDigitalUltraWide(
    lastOpened || liveStream || oldStream,
    detected,
    mainId,
  );
  if (digitalFirst) return digitalFirst;

  // 3) Re-open main + digital if stream died
  let stream = lastOpened || liveStream || oldStream;
  const trackLive =
    stream?.getVideoTracks?.()?.[0]?.readyState === "live";
  if (!trackLive) {
    try {
      stream = await startCameraByDeviceId(mainId, {
        facingMode: "environment",
        highRes: false,
        preferDeviceId: Boolean(mainId),
      });
      if (oldStream && oldStream !== stream) {
        try {
          clearTrackZoomCache(oldStream);
          stopCurrentCamera(oldStream, videoEl);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.warn("[ultra] open main failed", e?.message);
      return { unavailable: true, detected };
    }
  }

  const digitalRetry = await tryDigitalUltraWide(stream, detected, mainId);
  if (digitalRetry) return digitalRetry;

  // 4) Chỉ apply minZoom THẬT của track (không đoán 0.5/0.6)
  if (stream && supportsHardwareZoom(stream)) {
    const range = readZoomRange(stream);
    if (range.minZoom > 0.15 && range.minZoom < 0.95) {
      const target = range.minZoom;
      try {
        clearTrackZoomCache(stream);
        const applied = await applyCameraZoom(stream, target);
        if (applied !== false && Number(applied) < 0.95) {
          const factor = resolveUltraWideFactor(stream, detected, applied);
          return {
            stream,
            detected,
            deviceId: getCurrentTrackSettings(stream).deviceId || mainId,
            lensType: "main",
            zoomMode: "0.5x",
            currentZoom: factor || roundZoomFactor(applied),
            digitalZoom: applied,
            ultraFactor: factor || roundZoomFactor(applied),
            switchedDevice: false,
          };
        }
      } catch {
        /* ignore */
      }
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
