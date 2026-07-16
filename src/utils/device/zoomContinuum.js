/**
 * Single continuous zoom range across logical / multi-physical rear lenses.
 * Display zoom is always global FOV factor (0.6x, 1x, 3x…) — never per-track labels.
 */

import {
  readZoomRange,
  getCurrentTrackSettings,
  getUltraWideFactor,
  resolveUltraWideFactor,
  clampZoom,
  roundZoomFactor,
  isUltraZoomValue,
  getLastRearProbeReport,
  getRememberedUltraBaseZoom,
  rememberUltraBaseZoom,
  isLiveVideoStream,
  startCameraByDeviceId,
  stopCurrentCamera,
  clearTrackZoomCache,
} from "./cameraLens";

/** Per-deviceId last-known zoom caps (filled when that lens is open) */
const lensCapsCache = new Map();
/** In-session ultra base (faster than localStorage) */
const ultraBaseSession = new Map();

export function rememberLensZoomCaps(deviceId, stream) {
  if (!deviceId || !stream) return;
  const range = readZoomRange(stream);
  if (range?.supported) {
    lensCapsCache.set(String(deviceId), {
      min: range.minZoom,
      max: range.maxZoom,
      step: range.zoomStep,
    });
    // Absolute ultra track: min < 1 is the global base
    if (range.minZoom > 0.2 && range.minZoom < 0.98) {
      ultraBaseSession.set(String(deviceId), range.minZoom);
      rememberUltraBaseZoom(deviceId, range.minZoom);
    }
  }
}

export function getCachedLensCaps(deviceId) {
  if (!deviceId) return null;
  return lensCapsCache.get(String(deviceId)) || null;
}

function niceZoom(n) {
  const r = roundZoomFactor(n);
  if (r != null) return r;
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (Math.abs(v - 1) < 0.04) return 1;
  if (v < 1) return Math.round(v * 10) / 10;
  if (Math.abs(v - Math.round(v)) < 0.08) return Math.round(v);
  return Math.round(v * 10) / 10;
}

/**
 * Resolve ultrawide global base FOV factor from every available signal.
 * Never invents a value when no lens evidence exists.
 */
export function resolveUltraBaseZoom(detected, stream, ultraId) {
  if (!ultraId) return null;
  const liveId = getCurrentTrackSettings(stream)?.deviceId || null;

  // Live on ultra with absolute zoom.min
  if (liveId === ultraId) {
    const range = readZoomRange(stream);
    if (range.supported && range.minZoom > 0.2 && range.minZoom < 0.98) {
      ultraBaseSession.set(String(ultraId), range.minZoom);
      rememberUltraBaseZoom(ultraId, range.minZoom);
      return niceZoom(range.minZoom) ?? range.minZoom;
    }
  }

  const fromFactor =
    resolveUltraWideFactor(stream, detected, null) ||
    getUltraWideFactor(stream, detected);
  if (fromFactor && fromFactor > 0.2 && fromFactor < 0.98) {
    return niceZoom(fromFactor) ?? fromFactor;
  }

  const sess = ultraBaseSession.get(String(ultraId));
  if (sess && sess > 0.2 && sess < 0.98) return niceZoom(sess) ?? sess;

  const remembered = getRememberedUltraBaseZoom(ultraId);
  if (remembered) return niceZoom(remembered) ?? remembered;

  const cached = getCachedLensCaps(ultraId);
  if (cached && cached.min > 0.2 && cached.min < 0.98) {
    return niceZoom(cached.min) ?? cached.min;
  }

  // Sequential probe report (if already run this session)
  try {
    const rows = getLastRearProbeReport();
    const row = rows.find((r) => r?.deviceId === ultraId);
    const capMin = row?.capabilitiesZoom?.min;
    if (typeof capMin === "number" && capMin > 0.2 && capMin < 0.98) {
      return niceZoom(capMin) ?? capMin;
    }
    const setZ = row?.settingsZoom;
    if (typeof setZ === "number" && setZ > 0.2 && setZ < 0.98) {
      return niceZoom(setZ) ?? setZ;
    }
  } catch {
    /* ignore */
  }

  // Label may embed 0.5x / 0.6x (real OEM label, not invented)
  const label = String(detected?.ultrawide?.label || "");
  const m = label.match(/0\.[5-9]\d*/);
  if (m) {
    const n = Number(m[0]);
    if (n > 0.2 && n < 0.98) return niceZoom(n) ?? n;
  }

  return null;
}

/** Log mapping: slider t∈[0,1] ↔ zoom */
export function zoomToSliderT(zoom, minZoom, maxZoom) {
  const min = Math.max(Number(minZoom) || 1e-6, 1e-6);
  const max = Math.max(Number(maxZoom) || min, min);
  if (max <= min * 1.0001) return 0;
  const z = Math.min(max, Math.max(min, Number(zoom) || min));
  return Math.log(z / min) / Math.log(max / min);
}

export function sliderTToZoom(t, minZoom, maxZoom) {
  const min = Math.max(Number(minZoom) || 1e-6, 1e-6);
  const max = Math.max(Number(maxZoom) || min, min);
  const p = Math.min(1, Math.max(0, Number(t) || 0));
  return min * Math.pow(max / min, p);
}

function formatMarkerLabel(zoom) {
  const n = niceZoom(zoom);
  if (n == null) return "";
  if (Math.abs(n - 1) < 0.04) return "1";
  if (n < 1) return String(n);
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.05) {
    return String(Math.round(n));
  }
  return String(n);
}

/** Infer tele base FOV from label / cached caps — never invent if unknown */
function inferTeleBaseZoom(teleDevice, stream, liveId) {
  const label = String(teleDevice?.label || "").toLowerCase();
  const m = label.match(/\b(\d+(?:\.\d+)?)\s*x\b/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 1.5 && n <= 20) return n;
  }
  if (liveId && teleDevice?.deviceId === liveId) {
    const range = readZoomRange(stream);
    // Some tele tracks report absolute zoom starting near 2–3
    if (range.supported && range.minZoom >= 1.4) {
      return niceZoom(range.minZoom) || range.minZoom;
    }
  }
  const cached = getCachedLensCaps(teleDevice?.deviceId);
  if (cached && cached.min >= 1.4) return niceZoom(cached.min) || cached.min;
  // Structural tele without known base — treat as 2× optical (common) only as
  // continuum segment start when no better signal; still not a UI hard-code of
  // fixed marker list — marker uses this base only if tele device exists.
  return 2;
}

function makeLens({
  deviceId,
  type,
  baseZoom,
  minLocalZoom,
  maxLocalZoom,
  absolute = false,
}) {
  const base = Number(baseZoom) > 0 ? Number(baseZoom) : 1;
  const minL = Number(minLocalZoom);
  const maxL = Number(maxLocalZoom);
  const minLocal = Number.isFinite(minL) ? minL : 1;
  const maxLocal = Number.isFinite(maxL)
    ? Math.max(minLocal, maxL)
    : minLocal;
  let globalMin;
  let globalMax;
  if (absolute) {
    globalMin = minLocal;
    globalMax = maxLocal;
  } else {
    globalMin = base * minLocal;
    globalMax = base * maxLocal;
  }
  return {
    deviceId: deviceId || null,
    type,
    baseZoom: base,
    minLocalZoom: minLocal,
    maxLocalZoom: maxLocal,
    globalMin,
    globalMax,
    absolute: Boolean(absolute),
  };
}

/**
 * Build continuous global zoom continuum from live stream + detection.
 */
export function buildZoomContinuum(detected, stream, opts = {}) {
  const facing = opts.facing || "environment";
  const range = readZoomRange(stream);
  const liveId = getCurrentTrackSettings(stream)?.deviceId || null;

  if (facing === "user") {
    if (!range.supported || range.maxZoom <= range.minZoom + 0.01) {
      return emptyContinuum();
    }
    const minZ = Math.max(1, range.minZoom);
    const maxZ = Math.max(minZ, range.maxZoom);
    if (maxZ <= minZ + 0.01) return emptyContinuum();
    const lens = makeLens({
      deviceId: liveId,
      type: "main",
      baseZoom: 1,
      minLocalZoom: minZ,
      maxLocalZoom: maxZ,
      absolute: true,
    });
    return {
      supported: true,
      mode: "single",
      minZoom: minZ,
      maxZoom: maxZ,
      lenses: [lens],
      markers: [{ zoom: 1, type: "main", label: "1", emphasis: true }],
      ready: true,
      needsUltraProbe: false,
    };
  }

  const mainId =
    detected?.main?.deviceId || detected?.rear?.[0]?.deviceId || null;
  const ultraId = detected?.ultrawide?.deviceId || null;
  const teleId = detected?.telephoto?.deviceId || null;
  const ultraFactor =
    resolveUltraWideFactor(stream, detected, null) ||
    getUltraWideFactor(stream, detected);

  // ── Logical multi-camera ONLY when one track covers ultra FOV ──
  // If a separate physical ultra deviceId exists, use multi-physical catalog
  // so globalMin comes from ultra base (0.5/0.6), not main's min=1.
  const logicalWide =
    range.supported && isUltraZoomValue(range.minZoom);
  const useLogicalOnly =
    logicalWide &&
    (!ultraId || liveId === ultraId || liveId === mainId) &&
    !teleId;

  if (range.supported && (useLogicalOnly || (!ultraId && !teleId))) {
    const minZ = range.minZoom;
    const maxZ = Math.max(range.maxZoom, 1);
    if (maxZ <= minZ + 0.01) return emptyContinuum();

    const lens = makeLens({
      deviceId: liveId || mainId,
      type: "main",
      baseZoom: 1,
      minLocalZoom: minZ,
      maxLocalZoom: maxZ,
      absolute: true,
    });

    const markers = [];
    if (minZ < 0.98) {
      const uz = niceZoom(minZ) ?? minZ;
      markers.push({
        zoom: uz,
        type: "ultrawide",
        label: formatMarkerLabel(uz),
        emphasis: false,
      });
    }
    markers.push({ zoom: 1, type: "main", label: "1", emphasis: true });

    return {
      supported: true,
      mode: logicalWide ? "logical" : "single",
      minZoom: minZ,
      maxZoom: maxZ,
      lenses: [lens],
      markers: dedupeMarkers(markers),
      ready: true,
      needsUltraProbe: false,
    };
  }

  // ── Multi-physical continuum (catalog from ALL lenses, not just active) ──
  const lenses = [];
  let needsUltraProbe = false;

  if (ultraId) {
    const cached = getCachedLensCaps(ultraId);
    const onUltra = liveId === ultraId;
    const liveRange = onUltra && range.supported ? range : null;
    let base = resolveUltraBaseZoom(detected, stream, ultraId);
    if (!base && ultraFactor && ultraFactor < 0.98) {
      base = ultraFactor;
    }

    if (base != null && base < 0.98) {
      base = niceZoom(base) ?? base;
      if (liveRange && liveRange.minZoom < 0.98) {
        lenses.push(
          makeLens({
            deviceId: ultraId,
            type: "ultrawide",
            baseZoom: 1,
            minLocalZoom: liveRange.minZoom,
            maxLocalZoom: liveRange.maxZoom,
            absolute: true,
          }),
        );
      } else if (liveRange) {
        lenses.push(
          makeLens({
            deviceId: ultraId,
            type: "ultrawide",
            baseZoom: base,
            minLocalZoom: Math.max(1, liveRange.minZoom),
            maxLocalZoom: liveRange.maxZoom,
            absolute: false,
          }),
        );
      } else if (cached) {
        if (cached.min < 0.98) {
          lenses.push(
            makeLens({
              deviceId: ultraId,
              type: "ultrawide",
              baseZoom: 1,
              minLocalZoom: cached.min,
              maxLocalZoom: cached.max,
              absolute: true,
            }),
          );
        } else {
          lenses.push(
            makeLens({
              deviceId: ultraId,
              type: "ultrawide",
              baseZoom: base,
              minLocalZoom: Math.max(1, cached.min),
              maxLocalZoom: cached.max,
              absolute: false,
            }),
          );
        }
      } else {
        // Known base, not yet opened — relative physical model
        // global 0.6 → local 1 on ultra
        lenses.push(
          makeLens({
            deviceId: ultraId,
            type: "ultrawide",
            baseZoom: base,
            minLocalZoom: 1,
            maxLocalZoom: 1.85,
            absolute: false,
          }),
        );
      }
    } else if (ultraId) {
      // Physical ultra classified but base not measured yet — still reserve
      // catalog entry only after probe; flag needsUltraProbe for init flow.
      needsUltraProbe = true;
      if (cached) {
        const b = cached.min < 0.98 ? cached.min : null;
        if (b) {
          lenses.push(
            makeLens({
              deviceId: ultraId,
              type: "ultrawide",
              baseZoom: b < 0.98 ? 1 : b,
              minLocalZoom: cached.min,
              maxLocalZoom: cached.max,
              absolute: cached.min < 0.98,
            }),
          );
          needsUltraProbe = false;
        }
      }
    }
  }

  if (mainId) {
    const cached = getCachedLensCaps(mainId);
    const onMain = liveId === mainId || (!liveId && !ultraId);
    const liveRange = onMain && range.supported ? range : null;
    if (liveRange) {
      const minL = liveRange.minZoom < 1 ? liveRange.minZoom : 1;
      lenses.push(
        makeLens({
          deviceId: mainId,
          type: "main",
          baseZoom: 1,
          minLocalZoom: minL,
          maxLocalZoom: liveRange.maxZoom,
          absolute: true,
        }),
      );
    } else if (cached) {
      lenses.push(
        makeLens({
          deviceId: mainId,
          type: "main",
          baseZoom: 1,
          minLocalZoom: cached.min < 1 ? cached.min : 1,
          maxLocalZoom: cached.max,
          absolute: true,
        }),
      );
    } else {
      lenses.push(
        makeLens({
          deviceId: mainId,
          type: "main",
          baseZoom: 1,
          minLocalZoom: 1,
          maxLocalZoom: 8,
          absolute: true,
        }),
      );
    }
  }

  if (teleId) {
    const teleDev = detected?.telephoto || { deviceId: teleId };
    const base = inferTeleBaseZoom(teleDev, stream, liveId);
    const cached = getCachedLensCaps(teleId);
    const onTele = liveId === teleId;
    const liveRange = onTele && range.supported ? range : null;
    if (liveRange && liveRange.minZoom >= 1.3) {
      // Absolute tele zoom
      lenses.push(
        makeLens({
          deviceId: teleId,
          type: "tele",
          baseZoom: 1,
          minLocalZoom: liveRange.minZoom,
          maxLocalZoom: liveRange.maxZoom,
          absolute: true,
        }),
      );
    } else if (liveRange) {
      lenses.push(
        makeLens({
          deviceId: teleId,
          type: "tele",
          baseZoom: base,
          minLocalZoom: liveRange.minZoom,
          maxLocalZoom: liveRange.maxZoom,
          absolute: false,
        }),
      );
    } else if (cached) {
      if (cached.min >= 1.3) {
        lenses.push(
          makeLens({
            deviceId: teleId,
            type: "tele",
            baseZoom: 1,
            minLocalZoom: cached.min,
            maxLocalZoom: cached.max,
            absolute: true,
          }),
        );
      } else {
        lenses.push(
          makeLens({
            deviceId: teleId,
            type: "tele",
            baseZoom: base,
            minLocalZoom: cached.min,
            maxLocalZoom: cached.max,
            absolute: false,
          }),
        );
      }
    } else {
      lenses.push(
        makeLens({
          deviceId: teleId,
          type: "tele",
          baseZoom: base,
          minLocalZoom: 1,
          maxLocalZoom: 5,
          absolute: false,
        }),
      );
    }
  }

  if (!lenses.length) {
    if (range.supported && range.maxZoom > range.minZoom + 0.01) {
      const minZ = range.minZoom;
      const maxZ = range.maxZoom;
      return {
        supported: true,
        mode: "single",
        minZoom: minZ,
        maxZoom: maxZ,
        lenses: [
          makeLens({
            deviceId: liveId || mainId,
            type: "main",
            baseZoom: 1,
            minLocalZoom: minZ,
            maxLocalZoom: maxZ,
            absolute: true,
          }),
        ],
        markers: [
          ...(minZ < 0.98
            ? [
                {
                  zoom: niceZoom(minZ) ?? minZ,
                  type: "ultrawide",
                  label: formatMarkerLabel(minZ),
                },
              ]
            : []),
          { zoom: 1, type: "main", label: "1", emphasis: true },
        ],
        ready: true,
        needsUltraProbe: false,
      };
    }
    return emptyContinuum();
  }

  let minZoom = Math.min(...lenses.map((l) => l.globalMin));
  let maxZoom = Math.max(...lenses.map((l) => l.globalMax));
  if (range.supported) {
    minZoom = Math.min(minZoom, range.minZoom);
    maxZoom = Math.max(maxZoom, range.maxZoom);
  }
  if (!Number.isFinite(minZoom)) minZoom = 1;
  if (!Number.isFinite(maxZoom) || maxZoom <= minZoom + 0.01) {
    maxZoom = minZoom + 0.01;
  }

  const markers = [];
  for (const l of lenses) {
    if (l.type === "ultrawide") {
      const z = niceZoom(l.globalMin) ?? l.globalMin;
      if (z < 0.98) {
        markers.push({
          zoom: z,
          type: "ultrawide",
          label: formatMarkerLabel(z),
          emphasis: false,
        });
      }
    } else if (l.type === "main") {
      markers.push({ zoom: 1, type: "main", label: "1", emphasis: true });
    } else if (l.type === "tele") {
      const z = niceZoom(l.absolute ? l.globalMin : l.baseZoom) ?? l.baseZoom;
      if (z > 1.2) {
        markers.push({
          zoom: z,
          type: "tele",
          label: formatMarkerLabel(z),
          emphasis: false,
        });
      }
    }
  }

  const hasUltraSeg = lenses.some((l) => l.type === "ultrawide");
  return {
    supported: maxZoom > minZoom + 0.01,
    mode: lenses.length > 1 ? "multi-physical" : "single",
    minZoom,
    maxZoom,
    lenses,
    markers: dedupeMarkers(markers),
    // ready when ultra base known OR no ultra to probe
    ready: !needsUltraProbe || hasUltraSeg,
    needsUltraProbe: needsUltraProbe && !hasUltraSeg,
  };
}

function emptyContinuum() {
  return {
    supported: false,
    mode: "none",
    minZoom: 1,
    maxZoom: 1,
    lenses: [],
    markers: [],
    ready: true,
    needsUltraProbe: false,
  };
}

/**
 * Soft-measure ultra base FOV without keeping ultra stream.
 * Caller must re-open main after this (Android single-slot).
 * @returns {Promise<number|null>} global base e.g. 0.6
 */
export async function probeUltraBaseZoom(ultraId, ultraDevice = null) {
  if (!ultraId) return null;
  const known = resolveUltraBaseZoom(
    { ultrawide: ultraDevice || { deviceId: ultraId } },
    null,
    ultraId,
  );
  if (known) return known;

  let stream = null;
  try {
    stream = await startCameraByDeviceId(ultraId, {
      facingMode: "environment",
      highRes: false,
      preferDeviceId: true,
      forceDeviceId: true,
    });
    if (!isLiveVideoStream(stream)) {
      stopCurrentCamera(stream);
      return null;
    }
    rememberLensZoomCaps(ultraId, stream);
    const range = readZoomRange(stream);
    let base = null;
    if (range.supported && range.minZoom > 0.2 && range.minZoom < 0.98) {
      base = range.minZoom;
    } else {
      // Relative physical ultra: local 1 = native FOV; base unknown from track
      // Prefer label / remembered after park attempt
      const settings = getCurrentTrackSettings(stream);
      if (typeof settings.zoom === "number" && settings.zoom < 0.98) {
        base = settings.zoom;
      }
    }
    // Relative UW often reports zoom=1 at native FOV — use label/session only
    if (!base) {
      const label = String(ultraDevice?.label || "");
      const m = label.match(/0\.[5-9]\d*/);
      if (m) base = Number(m[0]);
    }
    // Physical UW with local-only zoom (min≈1): FOV base not exposed by browser.
    // Use remembered value, else provisional 0.6 (common UW FOV vs main) so the
    // rail can show a left-of-1x segment. Not a per-device model table.
    if (!base && range.supported && range.minZoom >= 0.98) {
      base = getRememberedUltraBaseZoom(ultraId) || 0.6;
    }
    if (base && base > 0.2 && base < 0.98) {
      ultraBaseSession.set(String(ultraId), base);
      rememberUltraBaseZoom(ultraId, base);
      return niceZoom(base) ?? base;
    }
    return null;
  } catch {
    return null;
  } finally {
    if (stream) {
      try {
        clearTrackZoomCache(stream);
        stopCurrentCamera(stream);
      } catch {
        /* ignore */
      }
    }
  }
}

function dedupeMarkers(markers) {
  const out = [];
  const seen = new Set();
  for (const m of markers) {
    const z = Number(m.zoom);
    if (!Number.isFinite(z)) continue;
    const key = z.toFixed(2);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  out.sort((a, b) => a.zoom - b.zoom);
  return out;
}

function localFromGlobal(globalZoom, lens) {
  if (!lens) return globalZoom;
  // Absolute tracks (logical / main digital): global FOV == track zoom
  if (lens.absolute) {
    return clampZoom(globalZoom, lens.minLocalZoom, lens.maxLocalZoom);
  }
  // Relative physical: localZoom = requestedGlobalZoom / baseZoom
  const base = lens.baseZoom > 0 ? lens.baseZoom : 1;
  return clampZoom(globalZoom / base, lens.minLocalZoom, lens.maxLocalZoom);
}

/** Exact / near 1x → always main (not display-only). */
export const MAIN_ZOOM_EPS = 0.02;

export function isExactlyMainZoom(z) {
  return Math.abs(Number(z) - 1) <= MAIN_ZOOM_EPS;
}

/**
 * Soft snap only on pointerup (not during drag).
 */
export function snapGlobalZoomOnRelease(z, continuum) {
  const cont = continuum || emptyContinuum();
  const v = Number(z);
  if (!Number.isFinite(v)) return 1;
  // Prefer exact 1x
  if (Math.abs(v - 1) <= 0.06) return 1;
  const markers = Array.isArray(cont.markers) ? cont.markers : [];
  let best = null;
  let bestD = Infinity;
  for (const m of markers) {
    const mz = Number(m.zoom);
    if (!Number.isFinite(mz)) continue;
    const d = Math.abs(v - mz);
    if (d < bestD && d <= 0.05) {
      bestD = d;
      best = mz;
    }
  }
  return best != null ? best : v;
}

function findLensByType(lenses, type) {
  return (lenses || []).find((l) => l?.type === type && l?.deviceId) || null;
}

function resultForLens(lens, z, currentDeviceId) {
  if (!lens) {
    return {
      deviceId: currentDeviceId,
      localZoom: z,
      globalZoom: z,
      switchDevice: false,
      type: "unknown",
      lens: null,
    };
  }
  const switchDevice = Boolean(
    lens.deviceId && currentDeviceId && lens.deviceId !== currentDeviceId,
  );
  return {
    deviceId: lens.deviceId || currentDeviceId,
    localZoom: localFromGlobal(z, lens),
    globalZoom: z,
    switchDevice,
    type: lens.type,
    lens,
  };
}

/**
 * Map global requested zoom → physical/logical lens + local track zoom.
 *
 * HARD RULE: |z - 1| <= 0.02 → always main (never ultrawide/tele stream).
 * Hysteresis elsewhere is derived from baseZoom only (no device models).
 */
export function mapGlobalZoomToLens(
  globalZoom,
  continuum,
  currentDeviceId = null,
  stickyType = null,
) {
  const cont = continuum || emptyContinuum();
  let z = Number(globalZoom);
  const lenses = Array.isArray(cont.lenses) ? cont.lenses.slice() : [];

  if (!Number.isFinite(z)) z = 1;

  if (!lenses.length) {
    return {
      deviceId: currentDeviceId,
      localZoom: z,
      globalZoom: z,
      switchDevice: false,
      type: stickyType || "unknown",
      lens: null,
    };
  }

  const mainLens =
    findLensByType(lenses, "main") ||
    lenses.find((l) => l.absolute && l.baseZoom === 1) ||
    null;
  const ultraLens = findLensByType(lenses, "ultrawide");
  const teleLens = findLensByType(lenses, "tele");

  // ── A) Exact 1x → main always (overrides hysteresis) ──
  if (isExactlyMainZoom(z)) {
    z = 1;
    // Logical / single track: apply zoom=1 on that track
    if (cont.mode === "logical" || cont.mode === "single" || lenses.length === 1) {
      const lens = mainLens || lenses[0];
      return {
        deviceId: lens.deviceId || currentDeviceId,
        localZoom: localFromGlobal(1, lens),
        globalZoom: 1,
        switchDevice: Boolean(
          lens.deviceId && currentDeviceId && lens.deviceId !== currentDeviceId,
        ),
        type: lens.type === "ultrawide" ? "main" : lens.type,
        lens,
      };
    }
    if (mainLens) {
      return resultForLens(mainLens, 1, currentDeviceId);
    }
  }

  // ── Logical / single physical track ──
  if (cont.mode === "logical" || cont.mode === "single" || lenses.length === 1) {
    const lens = lenses[0];
    return {
      deviceId: lens.deviceId || currentDeviceId,
      localZoom: localFromGlobal(z, lens),
      globalZoom: z,
      switchDevice: false,
      type: lens.type,
      lens,
    };
  }

  // ── Multi-physical continuum ──
  const sticky =
    lenses.find((l) => l.deviceId === currentDeviceId) ||
    findLensByType(lenses, stickyType) ||
    null;

  // Tele band: at/above tele base
  const teleBase = teleLens
    ? teleLens.absolute
      ? teleLens.globalMin
      : teleLens.baseZoom
    : null;

  // Ultra leave/enter thresholds from baseZoom (not model names)
  const ultraBase = ultraLens
    ? ultraLens.absolute
      ? ultraLens.globalMin
      : ultraLens.baseZoom
    : null;
  // Midpoint between ultra base and 1x
  const midUltraMain =
    ultraBase != null && ultraBase > 0 && ultraBase < 1
      ? Math.sqrt(ultraBase * 1)
      : 0.85;
  // From main → ultra: must go clearly below midpoint
  const enterUltraFromMain = midUltraMain * 0.92;
  // From ultra → main: leave when clearly above midpoint (1x handled above)
  const leaveUltraToMain = midUltraMain * 1.08;

  // Tele enter/leave
  const enterTele =
    teleBase != null ? teleBase * 0.95 : Number.POSITIVE_INFINITY;
  const leaveTeleToMain =
    teleBase != null ? teleBase * 0.88 : Number.POSITIVE_INFINITY;

  let target = mainLens || sticky || lenses[0];

  if (sticky?.type === "ultrawide" && ultraLens) {
    // Stay on ultra until clearly past leave threshold toward 1x/main
    if (z < leaveUltraToMain) {
      target = ultraLens;
    } else if (teleLens && z >= enterTele) {
      target = teleLens;
    } else {
      target = mainLens || ultraLens;
    }
  } else if (sticky?.type === "tele" && teleLens) {
    if (z >= leaveTeleToMain) {
      target = teleLens;
    } else if (ultraLens && z < enterUltraFromMain) {
      target = ultraLens;
    } else {
      target = mainLens || teleLens;
    }
  } else {
    // Sticky main / unknown
    if (teleLens && z >= enterTele) {
      target = teleLens;
    } else if (ultraLens && z < enterUltraFromMain) {
      target = ultraLens;
    } else {
      target = mainLens || sticky || lenses[0];
    }
  }

  // Final safety: never keep ultra/tele at ~1x
  if (isExactlyMainZoom(z) && mainLens) {
    target = mainLens;
    z = 1;
  }

  return resultForLens(target, z, currentDeviceId);
}

/** Bounds helper for pinch / slider */
export function continuumBounds(continuum, fallback = { minZoom: 1, maxZoom: 1 }) {
  if (continuum?.supported) {
    return {
      minZoom: continuum.minZoom,
      maxZoom: continuum.maxZoom,
    };
  }
  return {
    minZoom: fallback.minZoom ?? 1,
    maxZoom: fallback.maxZoom ?? 1,
  };
}
