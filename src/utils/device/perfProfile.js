/**
 * Profile hiệu năng thiết bị — tối ưu Android / máy yếu.
 * Dùng cho camera, tuyết, blur, poll.
 */

let cached = null;

function detect() {
  if (typeof navigator === "undefined") {
    return {
      isAndroid: false,
      isIOS: false,
      isMobile: false,
      isLowEnd: false,
      cores: 4,
      memGB: 4,
    };
  }

  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile =
    isAndroid ||
    isIOS ||
    /Mobile|webOS|BlackBerry/i.test(ua) ||
    (typeof window !== "undefined" && window.matchMedia?.("(max-width: 768px)")?.matches);

  const cores = navigator.hardwareConcurrency || 4;
  // deviceMemory (GB) — Chrome Android
  const memGB = navigator.deviceMemory || 4;

  // Low-end: Android + (≤4 cores hoặc ≤2GB RAM) hoặc save-data
  const saveData = navigator.connection?.saveData === true;
  const isLowEnd =
    saveData ||
    (isAndroid && (cores <= 4 || memGB <= 2)) ||
    (isMobile && cores <= 2);

  return { isAndroid, isIOS, isMobile, isLowEnd, cores, memGB, saveData };
}

export function getPerfProfile() {
  if (!cached) cached = detect();
  return cached;
}

/** Gắn class lên <html> để CSS giảm blur / effect */
export function applyPerfClasses() {
  if (typeof document === "undefined") return;
  const p = getPerfProfile();
  const root = document.documentElement;
  root.classList.toggle("perf-android", p.isAndroid);
  root.classList.toggle("perf-mobile", p.isMobile);
  root.classList.toggle("perf-lite", p.isLowEnd || p.isAndroid);
}

/**
 * Constraint camera preview — Android/lite: 720p@24, desktop: 1280x720@30
 */
export function getCameraPreviewConstraints(base = {}) {
  const p = getPerfProfile();
  if (p.isAndroid || p.isLowEnd) {
    return {
      ...base,
      width: { ideal: 960, max: 1280 },
      height: { ideal: 540, max: 720 },
      frameRate: { ideal: 24, max: 30 },
    };
  }
  if (p.isMobile) {
    return {
      ...base,
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    };
  }
  return {
    ...base,
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 30 },
  };
}

/**
 * Cấu hình tuyết theo thiết bị + route
 */
export function getSnowPerfConfig({ onCameraRoute, isPinkSnow, isPink }) {
  const p = getPerfProfile();

  // Android camera: tắt hẳn hoặc rất ít
  if ((p.isAndroid || p.isLowEnd) && onCameraRoute) {
    return { enabled: true, intervalMs: 320, maxFlakes: 8, lite: true };
  }
  if (p.isAndroid || p.isLowEnd) {
    return {
      enabled: true,
      intervalMs: isPinkSnow ? 180 : 220,
      maxFlakes: isPinkSnow ? 18 : 12,
      lite: true,
    };
  }
  if (p.isMobile && onCameraRoute) {
    return { enabled: true, intervalMs: 200, maxFlakes: 16, lite: true };
  }

  // Desktop / iOS mạnh
  if (onCameraRoute) {
    return {
      enabled: true,
      intervalMs: isPinkSnow ? 140 : 180,
      maxFlakes: isPinkSnow ? 22 : 16,
      lite: false,
    };
  }
  return {
    enabled: true,
    intervalMs: isPinkSnow ? 80 : isPink ? 100 : 130,
    maxFlakes: isPinkSnow ? 48 : isPink ? 36 : 28,
    lite: false,
  };
}
