/**
 * Camera device classification (compat layer).
 * Default rear lens is ALWAYS main wide @ 1x — never telephoto/macro.
 * Core logic lives in cameraLens.js.
 */

import {
  isUltraLabel,
  isTeleLabel,
  detectAndClassifyCameras,
  clearDeviceProbeCache,
  scheduleCameraCapabilityProbe,
} from "./cameraLens";

/** Cache enumerate — avoid enumerateDevices + permission every lens change */
let camerasCache = null;
let camerasCacheAt = 0;
const CAMERAS_CACHE_MS = 5 * 60 * 1000; // 5 phút — flip/zoom mượt
let warmPromise = null;

export const invalidateCameraCache = () => {
  camerasCache = null;
  camerasCacheAt = 0;
  warmPromise = null;
  clearDeviceProbeCache();
};

/**
 * Preload list camera nền — gọi sớm khi vào màn camera.
 */
export const warmCameraList = () => {
  if (camerasCache) return Promise.resolve(camerasCache);
  if (warmPromise) return warmPromise;
  warmPromise = getAvailableCameras({ force: false }).finally(() => {
    warmPromise = null;
  });
  return warmPromise;
};

/**
 * @param {{ force?: boolean }} [opts]
 */
export const getAvailableCameras = async (opts = {}) => {
  const force = Boolean(opts?.force);
  if (
    !force &&
    camerasCache &&
    Date.now() - camerasCacheAt < CAMERAS_CACHE_MS
  ) {
    return camerasCache;
  }

  const result = await detectAndClassifyCameras();
  camerasCache = {
    allCameras: result.allCameras,
    frontCameras: result.frontCameras,
    backCameras: result.backCameras,
    backUltraWideCamera: result.backUltraWideCamera,
    backNormalCamera: result.backNormalCamera,
    backZoomCamera: result.backZoomCamera,
    // Full rear list for manual lens pick / debug — never hide hardware
    rearOptions: result.backCameras || [],
    detected: result.detected || null,
  };
  camerasCacheAt = Date.now();

  // Background probe (non-blocking) — improves ultra pick on multi-lens phones
  // without slowing first open. Cache warms for next ultra tap / reclassify.
  try {
    const det = result.detected || {
      rear: result.backCameras,
      main: result.backNormalCamera,
      ultrawide: result.backUltraWideCamera,
      telephoto: result.backZoomCamera,
    };
    scheduleCameraCapabilityProbe(det);
  } catch {
    /* ignore */
  }

  return camerasCache;
};

/**
 * deviceId for mode + zoom.
 * 1x (default) → ALWAYS main rear. Never ultra / tele.
 *
 * @param {"user"|"environment"} mode
 * @param {"0.5x"|"1x"|"2x"|"max"|"3x"|string} [zoomLevel="1x"]
 */
export const pickCameraDeviceId = async (mode, zoomLevel = "1x") => {
  try {
    const cameras = await getAvailableCameras();
    if (mode === "user") {
      return cameras?.frontCameras?.[0]?.deviceId || null;
    }

    const mainId =
      cameras?.backNormalCamera?.deviceId ||
      cameras?.backCameras?.find((c) => !isUltraLabel(c.label) && !isTeleLabel(c.label))
        ?.deviceId ||
      cameras?.backCameras?.[0]?.deviceId ||
      null;

    const z = String(zoomLevel || "1x").toLowerCase();

    // Ultra-wide pill — any manufacturer factor 0.5–0.9 (or "uw" / "wide")
    if (
      z === "0.5x" ||
      z === "0.5" ||
      z === "0.6x" ||
      z === "0.6" ||
      z === "0.7x" ||
      z === "0.7" ||
      z === "0.8x" ||
      z === "0.8" ||
      z === "0.9x" ||
      z === "0.9" ||
      z === "wide" ||
      z === "uw"
    ) {
      return cameras?.backUltraWideCamera?.deviceId || mainId;
    }

    // 2x: prefer main (digital zoom); tele only as last resort at device pick
    if (z === "2x" || z === "2") {
      return mainId || cameras?.backZoomCamera?.deviceId || null;
    }

    // max stays on main (hardware zoom)
    if (z === "max") {
      return mainId;
    }

    // legacy 3x/5x → tele if present else main
    if (z === "3x" || z === "5x") {
      return cameras?.backZoomCamera?.deviceId || mainId;
    }

    // 1x and everything else → MUST main
    return mainId;
  } catch (e) {
    console.warn("pickCameraDeviceId:", e.message);
    return null;
  }
};

/** deviceId is ultra-wide (by label / classification) */
export const isDeviceUltraWide = async (deviceId) => {
  if (!deviceId) return false;
  try {
    const cameras = await getAvailableCameras();
    if (cameras?.backUltraWideCamera?.deviceId === deviceId) return true;
    const dev = cameras?.allCameras?.find((d) => d.deviceId === deviceId);
    return isUltraLabel(dev?.label || "");
  } catch {
    return false;
  }
};

/** deviceId is telephoto */
export const isDeviceTele = async (deviceId) => {
  if (!deviceId) return false;
  try {
    const cameras = await getAvailableCameras();
    if (cameras?.backZoomCamera?.deviceId === deviceId) return true;
    const dev = cameras?.allCameras?.find((d) => d.deviceId === deviceId);
    return isTeleLabel(dev?.label || "");
  } catch {
    return false;
  }
};

/**
 * deviceId required at zoom 1x (main wide).
 * Use when browser opens wrong lens.
 */
export const getMainBackCameraId = async () => {
  const cameras = await getAvailableCameras();
  return (
    cameras?.backNormalCamera?.deviceId ||
    cameras?.backCameras?.find(
      (c) => !isUltraLabel(c.label) && !isTeleLabel(c.label),
    )?.deviceId ||
    cameras?.backCameras?.[0]?.deviceId ||
    null
  );
};

