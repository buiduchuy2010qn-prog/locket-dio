/**
 * Camera lens selection + pinch zoom system.
 *
 * Rules:
 * - Default rear = main wide @ 1x (never telephoto / macro).
 * - 0.5x / 0.6x → ultra-wide if exposed, else zoom.min (Samsung = 0.6).
 * - Pinch: continuous zoom min→max; badge top-left only.
 * - No zoom slider / caption zoom controls.
 * - Stop old tracks only after the new stream is ready.
 */

import { getCameraPreviewConstraints } from "./perfProfile";
import { CONFIG } from "@/config";

// ─── Label matchers ───────────────────────────────────────────────

const FRONT_RE =
  /mặt\s*trước|front|user|trước|facing\s*front|selfie|camera2\s*1(?!\d)|camera1\s*1(?!\d)/;

// Mọi rear Samsung/Android: camera2 0/2/3… (không chỉ camera2 0 — S25 FE ultra = camera2 2)
const BACK_RE =
  /mặt\s*sau|back|rear|environment|sau|facing\s*back|outer|world|camera2\s*\d+|camera1\s*0/;

const AVOID_RE =
  /telephoto|\btele\b|\bzoom\b|macro|depth|portrait|periscope|chụp\s*xa|siêu\s*xa|bokeh|tof|time[\s-]?of[\s-]?flight/;

// 0.6x / 0.7x: Samsung / Pixel ultra-wide
const ULTRA_RE =
  /cực\s*rộng|siêu\s*rộng|góc\s*siêu\s*rộng|góc\s*rộng|ultra[\s_-]*wide|ultrawide|ultra\b|0\.[5-7]x|\b0\.[5-7]\b|wide[\s_-]*angle|fisheye|fish[\s_-]*eye|\buw\b|camera2\s*2(?!\d)|logical[\s_-]*multi|multi[\s_-]*camera|samsung[\s_-]*camera[\s_-]*2|cam[\s_-]*uw|uwcam|super[\s_-]*wide|extra[\s_-]*wide/;

const TELE_RE =
  /chụp\s*xa|telephoto|\btele\b|periscope|\b2x\b|\b3x\b|\b5x\b|\b10x\b|camera2\s*[3-9]/;

/** Samsung (S25 FE, …) ultra-wide thường là 0.6x, không phải 0.5x */
function isSamsungDevice() {
  try {
    return /samsung|sm-|galaxy/i.test(navigator.userAgent || "");
  } catch {
    return false;
  }
}

function defaultUltraFactor() {
  return isSamsungDevice() ? 0.6 : 0.5;
}

function roundZoomFactor(z) {
  const n = Number(z);
  if (!Number.isFinite(n)) return defaultUltraFactor();
  return Math.round(n * 10) / 10;
}

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

  // Samsung / Android: camera2 2 (ultra), camera2 3 (tele) đôi khi không match BACK_RE cũ.
  // Mọi device còn lại (không phải front) phải vào rear — nếu không 0.6x bị mất.
  const remaining = videoDevices.filter(
    (d) =>
      !front.some((c) => c.deviceId === d.deviceId) &&
      !rear.some((c) => c.deviceId === d.deviceId),
  );

  if (remaining.length) {
    if (!rear.length) {
      if (remaining.length >= 2) {
        // Heuristic: last ≈ rear main, first ≈ front nếu chưa có front
        rear.push(remaining[remaining.length - 1]);
        if (!front.length) front.push(remaining[0]);
        for (let i = 1; i < remaining.length - 1; i++) {
          rear.push(remaining[i]);
        }
        // remaining[0] đã front; nếu remaining.length===2 chỉ 1 rear
      } else {
        rear.push(remaining[0]);
      }
    } else {
      // Đã có rear (camera2 0) — thêm ultra/tele còn sót (camera2 2, 3…)
      for (const d of remaining) {
        if (!isFrontLabel(d.label || "")) rear.push(d);
      }
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
 * Ultra-wide picker — cố gắng có 0.5x trên mọi máy multi-lens.
 * 1) Label rõ (ultra / 0.5 / camera2 2 / siêu rộng …)
 * 2) Multi rear: non-main, non-tele → coi là ultra (Android dual/triple)
 * 3) 2 rear không label: cam còn lại (không phải main) = ultra
 */
export function pickUltraWideCamera(
  rearCameras = [],
  mainCamera = null,
  teleCamera = null,
) {
  if (!rearCameras.length) return null;

  const byLabel = rearCameras.find((d) => isUltraLabel(d.label || ""));
  if (byLabel) return byLabel;

  const mainId =
    mainCamera?.deviceId || pickMainRearCamera(rearCameras)?.deviceId;
  const teleId =
    teleCamera?.deviceId ||
    rearCameras.find((d) => isTeleLabel(d.label || ""))?.deviceId ||
    null;

  // Mọi rear khác main/tele — ứng viên ultra
  const others = rearCameras.filter(
    (d) =>
      d.deviceId !== mainId &&
      d.deviceId !== teleId &&
      !isTeleLabel(d.label || "") &&
      !AVOID_RE.test((d.label || "").toLowerCase()),
  );

  if (others.length) {
    // Ưu tiên: label gợi ý rộng, rồi index sớm (Android ultra hay đứng trước main)
    others.sort((a, b) => {
      const la = (a.label || "").toLowerCase();
      const lb = (b.label || "").toLowerCase();
      const sa = /wide|rộng|0\.[5-7]|uw|camera2\s*2/.test(la) ? 0 : 1;
      const sb = /wide|rộng|0\.[5-7]|uw|camera2\s*2/.test(lb) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const ia = rearCameras.findIndex((d) => d.deviceId === a.deviceId);
      const ib = rearCameras.findIndex((d) => d.deviceId === b.deviceId);
      return ia - ib;
    });
    return others[0];
  }

  // 2+ rear, không label: non-main = ultra (dual camera phổ biến)
  if (rearCameras.length >= 2 && mainId) {
    // Thử cam đứng trước main trong list (pattern Android)
    const mainIdx = rearCameras.findIndex((d) => d.deviceId === mainId);
    if (mainIdx > 0) {
      const earlier = rearCameras[mainIdx - 1];
      if (
        earlier &&
        !isTeleLabel(earlier.label || "") &&
        earlier.deviceId !== teleId
      ) {
        return earlier;
      }
    }
    // Hoặc bất kỳ rear khác main
    const other = rearCameras.find(
      (d) =>
        d.deviceId !== mainId &&
        d.deviceId !== teleId &&
        !isTeleLabel(d.label || ""),
    );
    if (other) return other;
  }

  // 1 rear only — không có ultra vật lý
  return null;
}

/**
 * Danh sách deviceId ứng viên ultra (thử lần lượt khi mở 0.5x).
 * Giúp máy không gắn label vẫn có góc siêu rộng.
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
  const primary = pickUltraWideCamera(rearCameras, mainCamera, teleCamera);
  const ids = [];
  if (primary?.deviceId) ids.push(primary.deviceId);
  for (const d of rearCameras) {
    if (!d?.deviceId) continue;
    if (d.deviceId === mainId || d.deviceId === teleId) continue;
    if (isTeleLabel(d.label || "")) continue;
    if (!ids.includes(d.deviceId)) ids.push(d.deviceId);
  }
  return ids;
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
  const tryOpen = async (video) =>
    navigator.mediaDevices.getUserMedia({ video, audio: false });

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

  // Lens cụ thể (0.5x / 2x): deviceId + verify facing nếu có
  if (preferDeviceId && deviceId) {
    try {
      const stream = await tryOpen({
        deviceId: { ideal: deviceId },
        facingMode: { ideal: want },
        ...quality,
      });
      return stream;
    } catch {
      try {
        return await tryOpen({ deviceId: { exact: deviceId }, ...quality });
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
 * Hệ số góc siêu rộng thực tế của máy: 0.5 / 0.6 / 0.7…
 * null = máy không hỗ trợ (không bật nút).
 * Samsung (S25 FE, …) = 0.6 khi có ultra vật lý / digital min.
 */
export function getUltraWideFactor(stream, detected = null) {
  const range = readZoomRange(stream);
  const hasPhysical =
    Boolean(detected?.ultrawide?.deviceId) ||
    listUltraWideCandidates(
      detected?.rear || [],
      detected?.main || null,
      detected?.telephoto || null,
    ).length > 0;

  // Digital zoom min (iOS / Samsung logical multi-cam) — tin capabilities
  if (range.supported && range.minZoom > 0.15 && range.minZoom < 0.95) {
    return roundZoomFactor(range.minZoom); // 0.5, 0.6, 0.7…
  }

  // Có lens ultra vật lý nhưng track hiện tại min=1 → factor theo hãng
  // Samsung S25 FE ultra = 0.6x; iPhone / khác ≈ 0.5x
  if (hasPhysical) return defaultUltraFactor();

  return null;
}

export function formatZoomModeLabel(mode, ultraFactor = null) {
  if (mode === "0.5x" || mode === "0.6x" || mode === "wide") {
    const f = Number(ultraFactor);
    if (Number.isFinite(f) && f > 0.2 && f < 0.95) {
      return String(Number(f.toFixed(1)));
    }
    // Samsung → 0.6; khác → 0.5
    return String(defaultUltraFactor());
  }
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
  const multiRear = (detected?.rear?.length || 0) >= 2;
  const ultraFactor = getUltraWideFactor(stream, detected);
  const hasUltraLens =
    Boolean(detected?.ultrawide?.deviceId) ||
    listUltraWideCandidates(
      detected?.rear || [],
      detected?.main || null,
      detected?.telephoto || null,
    ).length > 0;

  // Chỉ bật góc rộng khi máy THẬT SỰ có (lens ultra hoặc zoom min < 1)
  // Không bật mù 0.5 trên máy single-lens min=1
  const canWide =
    hasUltraLens ||
    (range.supported && range.minZoom > 0.15 && range.minZoom < 0.95);

  const modes = {
    "0.5x": canWide,
    "1x": true,
    "2x": false,
    // factor hiển thị: 0.5 / 0.6 / 0.7 theo máy
    ultraFactor: canWide ? ultraFactor || defaultUltraFactor() : null,
  };

  if (detected?.telephoto?.deviceId) modes["2x"] = true;
  else if (range.supported && range.maxZoom >= 1.8) modes["2x"] = true;
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

  if (m === "0.5x" || m === "0.5" || m === "0.6x" || m === "0.6" || m === "wide") {
    const factor =
      getUltraWideFactor(stream, detected) ||
      (range.supported && range.minZoom < 0.95
        ? roundZoomFactor(range.minZoom)
        : defaultUltraFactor());

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
    // 2) Ứng viên multi-rear
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
    // 3) Digital: DÙNG minZoom THẬT (0.5 / 0.6 / 0.7) — không ép 0.5
    if (range.supported && range.minZoom > 0.15 && range.minZoom < 0.99) {
      const z = range.minZoom;
      return {
        deviceId: mainId,
        digitalZoom: z,
        displayZoom: Math.round(z * 10) / 10,
        lensType: "main",
        mode: "0.5x",
        ultraFactor: Math.round(z * 10) / 10,
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

  // Pinch min = factor thật (0.6 Samsung); không hạ mù nếu không có ultra
  if (canWide && ultraFactor && ultraFactor < 0.95) {
    min = Math.min(min, ultraFactor);
  } else if (hasUltra) {
    min = Math.min(min, defaultUltraFactor());
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
    ultraFactor: canWide ? ultraFactor || defaultUltraFactor() : null,
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

  // ── wide band: ultra lens first, then digital min (0.5 / 0.6 / 0.7) ──
  if (z < 0.92) {
    const factor =
      getUltraWideFactor(stream, detected) ||
      (range.supported && range.minZoom < 0.95
        ? Math.round(range.minZoom * 10) / 10
        : null);

    if (ultraId) {
      return {
        deviceId: ultraId,
        digitalZoom: 1,
        displayZoom: factor || z,
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
  // Samsung S25 FE / multi-cam: minZoom ≈ 0.6
  if (!(range.minZoom > 0.15 && range.minZoom < 0.99)) return null;

  const z = range.minZoom;
  try {
    clearTrackZoomCache(stream);
    const applied = await applyCameraZoom(stream, z);
    if (applied === false) return null;
    // Chấp nhận nếu settings gần min (Samsung đôi khi lệch step)
    const settingsZ = getCurrentTrackSettings(stream)?.zoom;
    const ok =
      typeof settingsZ !== "number" ||
      settingsZ <= z + 0.15 ||
      Math.abs(settingsZ - z) < 0.2;
    if (!ok && typeof settingsZ === "number" && settingsZ >= 0.95) {
      // Vẫn kẹt ~1x → coi fail
      return null;
    }
    const factor = roundZoomFactor(
      typeof settingsZ === "number" && settingsZ < 0.95 ? settingsZ : z,
    );
    return {
      stream,
      detected,
      deviceId: getCurrentTrackSettings(stream).deviceId || mainId,
      lensType: "main",
      zoomMode: "0.5x",
      currentZoom: factor,
      digitalZoom: applied || z,
      ultraFactor: factor,
      switchedDevice: false,
    };
  } catch {
    return null;
  }
}

/**
 * Switch góc siêu rộng — factor thật (0.5 / 0.6 Samsung / 0.7).
 * 1) Digital minZoom TRƯỚC (Samsung logical multi-cam = 0.6, không restart)
 * 2) Physical ultra / multi-rear (chỉ stop stream cũ SAU khi mở stream mới)
 * 3) Re-open main + digital nếu stream chết giữa chừng
 */
export async function switchToUltraWide05(options = {}) {
  const { oldStream = null, videoEl = null, detected: detIn = null } = options;
  const detected = detIn || (await detectCameraDevices());
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

  // 1) Digital TRƯỚC — S25 FE / Chrome Samsung hay expose minZoom=0.6 trên main
  const digitalFirst = await tryDigitalUltraWide(oldStream, detected, mainId);
  if (digitalFirst) return digitalFirst;

  // 2) Physical ultra — KHÔNG stop oldStream cho đến khi new stream OK
  let lastOpened = null;
  for (const id of candidates) {
    try {
      const stream = await startCameraByDeviceId(id, {
        facingMode: "environment",
        highRes: false,
        preferDeviceId: true,
        facingOnly: false,
      });
      // Có stream mới → mới tắt stream cũ (tránh digital fallback chết)
      if (oldStream && oldStream !== stream) {
        clearTrackZoomCache(oldStream);
        stopCurrentCamera(oldStream, videoEl);
      }
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

      // Factor hiển thị: digital min nếu có, không thì 0.6 Samsung / 0.5 khác
      const factor =
        getUltraWideFactor(stream, detected) || defaultUltraFactor();
      return {
        stream,
        detected,
        deviceId: id,
        lensType: "ultrawide",
        zoomMode: "0.5x",
        currentZoom: factor,
        digitalZoom: 1,
        ultraFactor: factor,
        switchedDevice: true,
      };
    } catch (e) {
      console.warn("[ultra] open candidate failed", id, e?.message);
    }
  }

  // 3) Digital lại — re-open main nếu oldStream đã bị stop / ended
  let stream = lastOpened || oldStream;
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

  // 4) Thử ép zoom = defaultUltra (0.6 Samsung) dù capabilities lệch
  if (stream && supportsHardwareZoom(stream)) {
    const range = readZoomRange(stream);
    const target = Math.max(
      range.minZoom,
      Math.min(defaultUltraFactor(), range.maxZoom),
    );
    if (target < 0.95) {
      try {
        clearTrackZoomCache(stream);
        const applied = await applyCameraZoom(stream, target);
        if (applied !== false && Number(applied) < 0.95) {
          const factor = roundZoomFactor(applied);
          return {
            stream,
            detected,
            deviceId: getCurrentTrackSettings(stream).deviceId || mainId,
            lensType: "main",
            zoomMode: "0.5x",
            currentZoom: factor,
            digitalZoom: applied,
            ultraFactor: factor,
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
