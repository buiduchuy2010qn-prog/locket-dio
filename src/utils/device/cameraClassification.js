/**
 * Universal camera classification engine.
 *
 * No phone model tables. Works with any current/future smartphone by reading
 * whatever the browser exposes and combining signals.
 *
 * Signals used (all optional — missing ones are simply skipped):
 *  - MediaDeviceInfo: deviceId, groupId, label, kind
 *  - MediaTrackSettings: facingMode, width, height, aspectRatio, frameRate, zoom, …
 *  - MediaTrackCapabilities: zoom range, width/height ranges, focusDistance, …
 *  - Browser env (UA family) — diagnostic only, NEVER decides lens type
 *  - Multi-device structure (enumerateDevices rear set)
 *
 * NEVER classify ultra-wide from a zoom number alone (0.5 / 0.6 / … differ
 * across browsers and firmwares).
 *
 * If confidence is low → expose every rear camera for manual selection.
 */

// ─── Label matchers (multi-locale, structure — not model IDs) ─────

const FRONT_RE =
  /mặt\s*trước|front|user|trước|facing\s*front|selfie|camera2\s*1(?!\d)|camera1\s*1(?!\d)/i;

const BACK_RE =
  /mặt\s*sau|back|rear|environment|sau|facing\s*back|outer|world|camera2\s*\d+|camera1\s*0/i;

const CONFIDENT_ULTRA_RE =
  /ultra[\s_-]*wide|ultrawide|siêu\s*rộng|cực\s*rộng|góc\s*siêu\s*rộng|fisheye|fish[\s_-]*eye|super[\s_-]*wide|extra[\s_-]*wide|\buw\b|超广角|超廣角|초광각|超広角|grand[\s_-]*angle/i;

const ULTRA_WEAK_RE =
  /góc\s*rộng|wide[\s_-]*angle|secondary|aux(iliary)?|camera2\s*2(?!\d)|cam[_\s-]*2(?!\d)|lens[_\s-]*2(?!\d)|广角|광각|広角/i;

const TELE_RE =
  /chụp\s*xa|telephoto|\btele\b|periscope|\b2x\b|\b3x\b|\b5x\b|\b10x\b|camera2\s*[3-9]|cam[_\s-]*3|lens[_\s-]*3|长焦|長焦|망원|望遠/i;

const AVOID_RE =
  /macro|depth|portrait|bokeh|tof|time[\s-]?of[\s-]?flight|红外|ir\s*camera|monochrome/i;

const MAIN_HINT_RE =
  /\b1x\b|main|primary|standard|bình\s*thường|\bwide\b(?!\s*angle)|default|rear\s*camera|back\s*camera/i;

const ZOOM_IN_LABEL_RE = /0\.[5-9]\s*x|\b0\.[5-9]\b/;

/** Desktop / virtual webcams — never treat as multi-lens phone rear */
const VIRTUAL_DESKTOP_RE =
  /obs|virtual\s*cam|virtualcam|manycam|snap\s*camera|xsplit|nvidia\s*broadcast|droidcam|iriun|epoccam|ndi|capture\s*card|screen\s*capture|desktop\s*capture|integrated\s*webcam|built[\s-]*in\s*(hd\s*)?webcam|facetime\s*hd|usb\s*camera|logitech|microsoft\s*life|hd\s*pro\s*webcam|c920|c922|ivcam/i;

const NON_ZOOM_SIGNALS = new Set([
  "confident_label",
  "ultra_label",
  "multi_rear",
  "not_main",
  "not_tele",
  "index_hint",
  "secondary_hint",
  "facing_env",
  "group_sibling",
  "resolution_hint",
  "fov_hint",
  "focal_hint",
  "camera2_ultra_index",
  "android_aux_rear",
]);

/** Parse Android camera2 / camera1 numeric index from label */
export function parseCamera2Index(label = "") {
  const s = String(label);
  let m = s.match(/camera2\s*(\d+)/i);
  if (m) return Number(m[1]);
  m = s.match(/camera1\s*(\d+)/i);
  if (m) return Number(m[1]);
  m = s.match(/(?:^|[^\d])(\d)\s*,\s*facing/i);
  if (m) return Number(m[1]);
  return null;
}

export function isVirtualOrDesktopCamera(label = "") {
  return VIRTUAL_DESKTOP_RE.test(String(label || ""));
}

/**
 * Best-effort "mobile-ish" env for UX density only.
 * Lens selection / zoom MUST use feature detection (enumerateDevices, caps.zoom),
 * not this helper. Prefer shouldOfferLensPicker(rearCount).
 */
export function isPhoneLikeCameraEnv() {
  try {
    // Touch + coarse pointer is stronger than UA for tablets/phones
    const coarse =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    const touch = (navigator.maxTouchPoints || 0) > 0;
    if (coarse && touch) return true;
    // iPadOS desktop-mode Safari: MacIntel + multi-touch
    if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
      return true;
    // Fallback UA only when media queries unavailable
    const ua = String(navigator.userAgent || "");
    if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Feature-based: show manual lens UI when the browser exposes multiple rears
 * (or caller forces single-device try-list). Not userAgent-gated.
 * @param {number} rearCount
 * @param {{ force?: boolean }} [opts]
 */
export function shouldOfferLensPicker(rearCount = 0, opts = {}) {
  if (opts.force) return true;
  return Number(rearCount) >= 2;
}

// ─── Browser metadata (diagnostic only) ───────────────────────────

export function getBrowserCameraEnv() {
  try {
    const ua = String(navigator.userAgent || "");
    const vendor = String(navigator.vendor || "");
    let engine = "unknown";
    if (/SamsungBrowser/i.test(ua)) engine = "samsung";
    else if (/Edg\//i.test(ua)) engine = "edge";
    else if (/CriOS|Chrome/i.test(ua) && !/Edg\//i.test(ua)) engine = "chrome";
    else if (/FxiOS|Firefox/i.test(ua)) engine = "firefox";
    else if (/Safari/i.test(ua) && /Apple/i.test(vendor)) engine = "safari";
    return {
      engine,
      ua: ua.slice(0, 180),
      // Never used for lens decisions — only logging / telemetry
      diagnosticOnly: true,
    };
  } catch {
    return { engine: "unknown", ua: "", diagnosticOnly: true };
  }
}

// ─── Label helpers ────────────────────────────────────────────────

export function isFrontLabel(label = "") {
  return FRONT_RE.test(String(label));
}
export function isBackLabel(label = "") {
  return BACK_RE.test(String(label));
}
export function isConfidentUltraLabel(label = "") {
  return CONFIDENT_ULTRA_RE.test(String(label));
}
export function isUltraLabel(label = "") {
  const l = String(label);
  return (
    CONFIDENT_ULTRA_RE.test(l) ||
    ULTRA_WEAK_RE.test(l) ||
    ZOOM_IN_LABEL_RE.test(l)
  );
}
export function isTeleLabel(label = "") {
  const l = String(label);
  return TELE_RE.test(l) && !CONFIDENT_ULTRA_RE.test(l);
}
export function isAvoidLabel(label = "") {
  return AVOID_RE.test(String(label));
}

// ─── Extract all available track signals ──────────────────────────

/**
 * Pull every useful field from capabilities + settings.
 * Missing APIs are null — never invent values.
 *
 * @param {MediaStreamTrack|null} track
 * @param {MediaDeviceInfo|null} deviceInfo
 */
export function extractTrackSignals(track, deviceInfo = null) {
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

  const num = (v) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const range = (r) => {
    if (!r || typeof r !== "object") return null;
    return {
      min: num(r.min),
      max: num(r.max),
      step: num(r.step),
    };
  };

  // Non-standard / experimental fields some engines expose
  const focalLength =
    num(settings.focalLength) ??
    num(caps.focalLength?.min) ??
    num(caps.focalLength) ??
    null;

  const fieldOfView =
    num(settings.fieldOfView) ??
    num(settings.fov) ??
    num(caps.fieldOfView?.max) ??
    num(caps.fov?.max) ??
    null;

  const focusDistance = range(caps.focusDistance);

  const width =
    num(settings.width) ??
    num(caps.width?.max) ??
    null;
  const height =
    num(settings.height) ??
    num(caps.height?.max) ??
    null;

  return {
    deviceId:
      settings.deviceId || deviceInfo?.deviceId || null,
    groupId: deviceInfo?.groupId || settings.groupId || null,
    label: deviceInfo?.label || track?.label || "",
    facingMode: settings.facingMode || null,
    // Zoom — display / supporting only
    zoom: num(settings.zoom),
    zoomRange: range(caps.zoom),
    minZoom: range(caps.zoom)?.min ?? null,
    maxZoom: range(caps.zoom)?.max ?? null,
    // Sensor / stream resolution
    width,
    height,
    maxWidth: num(caps.width?.max),
    maxHeight: num(caps.height?.max),
    aspectRatio:
      num(settings.aspectRatio) ??
      (width && height ? width / height : null),
    frameRate: num(settings.frameRate),
    // Optional optical hints
    focalLength,
    fieldOfView,
    focusDistanceMin: focusDistance?.min ?? null,
    focusDistanceMax: focusDistance?.max ?? null,
    resizeMode: settings.resizeMode || null,
    // Raw dump for future-proofing (small)
    rawCapKeys: Object.keys(caps || {}).slice(0, 40),
    rawSettingKeys: Object.keys(settings || {}).slice(0, 40),
  };
}

/**
 * Probe a deviceId briefly and return full signal bag.
 * @param {string} deviceId
 * @param {MediaDeviceInfo|null} deviceInfo
 */
export async function probeDeviceSignals(deviceId, deviceInfo = null) {
  if (!deviceId || !navigator.mediaDevices?.getUserMedia) return null;
  let stream = null;
  try {
    const open = navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 320, max: 640 },
        height: { ideal: 240, max: 480 },
        frameRate: { ideal: 15, max: 24 },
      },
      audio: false,
    });
    stream = await Promise.race([
      open,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("probe-timeout")), 2500),
      ),
    ]);
    const track = stream.getVideoTracks?.()?.[0] || null;
    const signals = extractTrackSignals(track, deviceInfo);
    return { ...signals, probedAt: Date.now(), failed: false };
  } catch {
    return {
      deviceId,
      groupId: deviceInfo?.groupId || null,
      label: deviceInfo?.label || "",
      failed: true,
      probedAt: Date.now(),
    };
  } finally {
    try {
      stream?.getTracks?.().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
  }
}

// ─── Ensemble analysis ────────────────────────────────────────────

/**
 * Analyze one device as ultra-wide candidate.
 * Zoom is WEAK support only.
 *
 * @returns {{ score: number, signals: string[], lensGuess: string }}
 */
export function analyzeLensCandidate(device, ctx = {}) {
  const {
    mainId = null,
    teleId = null,
    rearIndex = 0,
    rearTotal = 1,
    probe = null,
    devices = [],
  } = ctx;

  if (!device?.deviceId) {
    return { score: -999, signals: [], lensGuess: "unknown" };
  }

  const label = String(device.label || probe?.label || "");
  const signals = [];
  let score = 0;
  let lensGuess = "unknown";

  // Facing from probe
  const facing = probe?.facingMode || null;
  if (facing === "user" || isFrontLabel(label)) {
    return {
      score: -500,
      signals: ["facing_user"],
      lensGuess: "front",
    };
  }
  if (facing === "environment") {
    score += 5;
    signals.push("facing_env");
  }

  if (device.deviceId === mainId) {
    return { score: -200, signals: ["is_main"], lensGuess: "main" };
  }
  if (device.deviceId === teleId || isTeleLabel(label)) {
    return {
      score: isTeleLabel(label) ? 80 : -150,
      signals: isTeleLabel(label) ? ["tele_label"] : ["is_tele"],
      lensGuess: "telephoto",
    };
  }

  // ── Labels (primary identity) ──
  if (isConfidentUltraLabel(label)) {
    score += 120;
    signals.push("confident_label");
    lensGuess = "ultrawide";
  } else if (ULTRA_WEAK_RE.test(label)) {
    score += 70;
    signals.push("ultra_label");
    lensGuess = "ultrawide";
  } else if (ZOOM_IN_LABEL_RE.test(label)) {
    score += 15;
    signals.push("zoom_in_label");
  } else if (MAIN_HINT_RE.test(label)) {
    score -= 20;
    signals.push("main_hint");
    lensGuess = "main";
  }

  if (AVOID_RE.test(label)) {
    score -= 80;
    signals.push("avoid");
  }

  if (
    /camera2\s*2(?!\d)|cam[_\s-]*2(?!\d)|lens[_\s-]*2(?!\d)|secondary|aux/i.test(
      label,
    )
  ) {
    score += 25;
    signals.push("secondary_hint");
  }

  // Android camera2 index (Samsung S25 FE: 0=main, 1=front, 2=ultra, 3+=tele)
  // Structural index — not a zoom number and not a phone-model table.
  const camIdx = parseCamera2Index(label);
  if (camIdx === 2 && rearTotal >= 2) {
    score += 55;
    signals.push("camera2_ultra_index", "secondary_hint", "android_aux_rear");
    if (lensGuess === "unknown") lensGuess = "ultrawide";
  } else if (camIdx != null && camIdx >= 3 && rearTotal >= 2) {
    score -= 35;
    signals.push("camera2_high_index");
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

  // ── Multi-device structure ──
  if (rearTotal >= 2) {
    score += 18;
    signals.push("multi_rear", "not_main");
    if (device.deviceId !== teleId) signals.push("not_tele");
  }
  if (rearTotal >= 2 && rearIndex === 0 && !isTeleLabel(label)) {
    score += 6;
    signals.push("index_hint");
  }

  // groupId siblings (same physical module family)
  const gid = device.groupId || probe?.groupId;
  if (gid && devices.length >= 2) {
    const siblings = devices.filter(
      (d) => d.groupId === gid && d.deviceId !== device.deviceId,
    );
    if (siblings.length) {
      score += 10;
      signals.push("group_sibling");
    }
  }

  // ── Zoom range (WEAK — never sole auto-pick) ──
  const minZ = probe?.minZoom;
  const maxZ = probe?.maxZoom;
  if (typeof minZ === "number") {
    if (minZ > 0.15 && minZ < 0.95) {
      score += 22;
      signals.push("min_zoom_lt_1");
    } else if (minZ >= 0.95 && minZ <= 1.05) {
      score -= 20;
      signals.push("min_zoom_mainish");
    } else if (minZ > 1.2) {
      score -= 90;
      signals.push("min_zoom_teleish");
      lensGuess = lensGuess === "unknown" ? "telephoto" : lensGuess;
    }
  }
  if (typeof maxZ === "number" && maxZ >= 2.5 && minZ != null && minZ >= 1) {
    // High max with min>=1 often tele or main+digital
    score -= 5;
  }

  // ── Resolution (weak structural) ──
  const mw = probe?.maxWidth ?? probe?.width;
  const mh = probe?.maxHeight ?? probe?.height;
  if (mw && mh && rearTotal >= 2) {
    // Ultra modules sometimes lower-res than main — tiny bias only
    const mp = (mw * mh) / 1e6;
    if (mp > 0 && mp < 8) {
      score += 8;
      signals.push("resolution_hint");
    }
  }

  // ── FOV / focal (rare but powerful when present) ──
  if (typeof probe?.fieldOfView === "number") {
    // Wider FOV → more ultra-like (typical UW > 80°, main ~60–75°)
    if (probe.fieldOfView >= 85) {
      score += 40;
      signals.push("fov_hint");
      lensGuess = "ultrawide";
    } else if (probe.fieldOfView <= 45) {
      score -= 40;
      signals.push("fov_narrow");
      lensGuess = "telephoto";
    }
  }
  if (typeof probe?.focalLength === "number") {
    // Shorter focal → wider (relative within multi-cam set is better;
    // absolute mm varies — keep weak)
    if (probe.focalLength > 0 && probe.focalLength < 3) {
      score += 15;
      signals.push("focal_hint");
    } else if (probe.focalLength >= 5) {
      score -= 15;
    }
  }

  if (lensGuess === "unknown" && score >= 50 && signals.includes("ultra_label")) {
    lensGuess = "ultrawide";
  }
  if (lensGuess === "unknown" && score > 0 && rearTotal >= 2) {
    lensGuess = "candidate";
  }

  return { score, signals, lensGuess };
}

/**
 * @returns {"high"|"medium"|"low"|"none"}
 */
export function confidenceFromAnalysis({ score = 0, signals = [] } = {}) {
  const nonZoom = signals.filter((s) => NON_ZOOM_SIGNALS.has(s));
  const hasConfident = signals.includes("confident_label");
  const hasUltra = signals.includes("ultra_label");
  const hasStructure =
    signals.includes("multi_rear") ||
    signals.includes("secondary_hint") ||
    signals.includes("fov_hint");

  if (score <= 0) return "none";
  if (hasConfident && score >= 80) return "high";
  if (hasUltra && hasStructure && score >= 60) return "high";
  if (signals.includes("fov_hint") && score >= 50) return "high";
  // Android camera2 index 2 + multi-rear = reliable UW on Samsung/Pixel/etc.
  if (signals.includes("camera2_ultra_index") && score >= 50) return "high";
  if (nonZoom.length >= 2 && score >= 40) return "medium";
  if ((hasUltra || hasStructure) && score >= 50) return "medium";
  if (signals.includes("android_aux_rear") && score >= 35) return "medium";
  if (score > 0) return "low";
  return "none";
}

export function hasNonZoomSignal(signals = []) {
  return signals.some((s) => NON_ZOOM_SIGNALS.has(s));
}

// ─── Partition devices ────────────────────────────────────────────

export function partitionVideoDevices(videoDevices = []) {
  const front = [];
  const rear = [];
  const virtual = [];
  const leftover = [];

  for (const d of videoDevices) {
    const label = d.label || "";
    if (isVirtualOrDesktopCamera(label)) {
      virtual.push(d);
      continue;
    }
    if (isFrontLabel(label)) {
      front.push(d);
      continue;
    }
    if (isBackLabel(label)) {
      rear.push(d);
      continue;
    }
    leftover.push(d);
  }

  // Android camera2 aux (2, 3…) sometimes only match partially — keep all non-front
  for (const d of leftover) {
    const idx = parseCamera2Index(d.label || "");
    if (idx === 1 && !front.length) {
      front.push(d);
    } else if (!isFrontLabel(d.label || "")) {
      rear.push(d);
    }
  }

  // Pull obvious front out of rear if mis-bucketed
  for (let i = rear.length - 1; i >= 0; i--) {
    if (isFrontLabel(rear[i].label || "")) {
      front.push(rear.splice(i, 1)[0]);
    }
  }

  // Desktop-only: virtual/webcams are NOT multi-lens rear for manual pick
  // (still available as generic video inputs via all[])
  if (!isPhoneLikeCameraEnv() && !rear.length && virtual.length) {
    // Put first virtual as "main" so UI still works on PC preview
    rear.push(virtual[0]);
  }

  return { front, rear, virtual };
}

function scoreMainCamera(device, index, total) {
  const label = (device.label || "").toLowerCase();
  let score = 50;
  if (isConfidentUltraLabel(label) || ULTRA_WEAK_RE.test(label)) score -= 100;
  else if (isTeleLabel(label) || AVOID_RE.test(label)) score -= 80;
  else score += 40;
  if (MAIN_HINT_RE.test(label)) score += 30;
  if (total >= 2 && index === 1 && !isUltraLabel(label) && !isTeleLabel(label)) {
    score += 25;
  }
  return score;
}

export function pickMainRear(rear = []) {
  if (!rear.length) return null;
  const scored = rear.map((device, index) => ({
    device,
    score: scoreMainCamera(device, index, rear.length),
  }));
  scored.sort((a, b) => b.score - a.score);
  // Prefer non-ultra non-tele
  const preferred = scored.filter(
    (s) =>
      !isUltraLabel(s.device.label || "") &&
      !isTeleLabel(s.device.label || "") &&
      !AVOID_RE.test(s.device.label || ""),
  );
  const pool = preferred.length ? preferred : scored;
  return pool[0]?.device || rear[0];
}

export function pickTeleRear(rear = [], main = null) {
  const byLabel = rear.find((d) => isTeleLabel(d.label || ""));
  if (byLabel) return byLabel;
  if (rear.length >= 3) {
    const mainId = main?.deviceId;
    return [...rear].reverse().find((d) => d.deviceId !== mainId) || null;
  }
  return null;
}

/**
 * Full universal classification of all video inputs.
 *
 * @param {MediaDeviceInfo[]} videoDevices
 * @param {Map<string, object>|Record<string, object>} [probeMap]
 */
export function classifyCameras(videoDevices = [], probeMap = null) {
  const getProbe = (id) => {
    if (!id || !probeMap) return null;
    if (typeof probeMap.get === "function") return probeMap.get(id) || null;
    return probeMap[id] || null;
  };

  const { front, rear } = partitionVideoDevices(videoDevices);
  const main = pickMainRear(rear);
  const telephoto = pickTeleRear(rear, main);

  const ranked = rear.map((device, rearIndex) => {
    const probe = getProbe(device.deviceId);
    const analysis = analyzeLensCandidate(device, {
      mainId: main?.deviceId,
      teleId: telephoto?.deviceId,
      rearIndex,
      rearTotal: rear.length,
      probe,
      devices: videoDevices,
    });
    return {
      device,
      deviceId: device.deviceId,
      label: device.label || "",
      groupId: device.groupId || null,
      ...analysis,
      confidence: confidenceFromAnalysis(analysis),
      probe,
    };
  });
  ranked.sort((a, b) => b.score - a.score);

  // Auto ultra: high/medium first, then aggressive multi-rear fallback
  // so 0.5x works on every multi-lens phone (labels often empty in Chrome).
  let ultrawide = null;
  const confidentLabel = rear.find((d) =>
    isConfidentUltraLabel(d.label || ""),
  );
  if (confidentLabel) {
    ultrawide = confidentLabel;
  } else {
    const best = ranked.find(
      (r) =>
        r.deviceId !== main?.deviceId &&
        r.deviceId !== telephoto?.deviceId &&
        (r.confidence === "high" || r.confidence === "medium") &&
        hasNonZoomSignal(r.signals) &&
        r.lensGuess !== "telephoto",
    );
    ultrawide = best?.device || null;
  }

  // Fallback: camera2 index 2 when ensemble left ultra empty (Samsung S25 FE)
  if (!ultrawide && rear.length >= 2) {
    const byIdx = rear.find((d) => {
      if (d.deviceId === main?.deviceId || d.deviceId === telephoto?.deviceId)
        return false;
      return parseCamera2Index(d.label || "") === 2;
    });
    if (byIdx) ultrawide = byIdx;
  }

  // Aggressive: multi-rear without confident label → still assign best non-main
  if (!ultrawide && rear.length >= 2) {
    const bestLow = ranked.find(
      (r) =>
        r.deviceId !== main?.deviceId &&
        r.deviceId !== telephoto?.deviceId &&
        r.lensGuess !== "telephoto" &&
        r.score > -50,
    );
    if (bestLow?.device) ultrawide = bestLow.device;
  }

  const bestRanked = ranked.find((r) => r.deviceId === ultrawide?.deviceId);
  const ultraConfidence = ultrawide
    ? bestRanked?.confidence ||
      (parseCamera2Index(ultrawide.label || "") === 2 ? "high" : "medium")
    : ranked.some((r) => r.score > 0 && r.deviceId !== main?.deviceId)
      ? "low"
      : "none";

  // Manual pick optional — never block auto 0.5x trial
  const phoneEnv = isPhoneLikeCameraEnv();
  const needsManualLensPick =
    phoneEnv && rear.length >= 2 && ultraConfidence === "low" && !ultrawide;

  return {
    all: videoDevices,
    front,
    rear,
    main,
    telephoto,
    ultrawide,
    rearOptions: rear.slice(),
    ultraConfidence,
    needsManualLensPick,
    ultraRanked: ranked,
    browser: getBrowserCameraEnv(),
    isPhoneEnv: phoneEnv,
  };
}

/**
 * Classify a single live stream's active track.
 */
export function classifyLiveTrack(stream, classified = null) {
  const track = stream?.getVideoTracks?.()?.[0] || null;
  if (!track) return { lensType: "unknown", signals: extractTrackSignals(null) };
  const signals = extractTrackSignals(track);
  const deviceId = signals.deviceId;
  if (classified) {
    if (deviceId === classified.main?.deviceId) {
      return { lensType: "main", signals };
    }
    if (deviceId === classified.ultrawide?.deviceId) {
      return { lensType: "ultrawide", signals };
    }
    if (deviceId === classified.telephoto?.deviceId) {
      return { lensType: "telephoto", signals };
    }
  }
  if (signals.facingMode === "user") {
    return { lensType: "front", signals };
  }
  if (isConfidentUltraLabel(signals.label)) {
    return { lensType: "ultrawide", signals };
  }
  if (isTeleLabel(signals.label)) {
    return { lensType: "telephoto", signals };
  }
  return { lensType: "main", signals };
}
