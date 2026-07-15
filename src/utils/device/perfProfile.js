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

  // Pause decorative FX when tab hidden
  if (!root.dataset.tabVisBound) {
    root.dataset.tabVisBound = "1";
    const sync = () => {
      root.classList.toggle("tab-hidden", document.hidden);
    };
    document.addEventListener("visibilitychange", sync);
    sync();
  }
}

/**
 * Constraint camera stream — adaptive high quality.
 *
 * Ảnh/video chụp từ frame của <video>, nên độ phân giải stream ≈ chất lượng
 * capture. Dùng `ideal` (không `exact` / hard `max` thấp) để:
 *  - Máy mạnh: 1080p+ @ 60 FPS khi hỗ trợ
 *  - Máy yếu: browser tự hạ xuống mức hỗ trợ — getUserMedia không fail
 *
 * Không set `max` thấp (trước đây 720/960) — đó là nguyên nhân blur chính.
 */
export function getCameraPreviewConstraints(base = {}) {
  const p = getPerfProfile();
  // Không dùng advanced focusMode — chậm mở cam trên nhiều máy Android

  // Máy yếu / save-data: 720p@30 ideal — vẫn nét hơn 640, không force
  if (p.isLowEnd) {
    return {
      ...base,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    };
  }

  // Android / iOS / desktop: target Full HD @ 60 FPS (ideal only)
  // Browser chọn highest available ≤ ideal khi sensor/driver không đủ.
  return {
    ...base,
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 60 },
  };
}

/**
 * Sau khi getUserMedia OK — nâng resolution/fps nếu track còn dư headroom.
 * An toàn: try/catch, không throw; không đổi deviceId/facing.
 * @param {MediaStream} stream
 * @returns {Promise<MediaStream>}
 */
export async function upgradeStreamQuality(stream) {
  const track = stream?.getVideoTracks?.()?.[0];
  if (!track || typeof track.getCapabilities !== "function") return stream;
  if (typeof track.applyConstraints !== "function") return stream;

  try {
    const caps = track.getCapabilities() || {};
    const settings = track.getSettings?.() || {};
    const p = getPerfProfile();

    const maxW = caps.width?.max;
    const maxH = caps.height?.max;
    const maxFps = caps.frameRate?.max;

    const targetW = p.isLowEnd ? 1280 : 1920;
    const targetH = p.isLowEnd ? 720 : 1080;
    const targetFps = p.isLowEnd ? 30 : 60;

    const wantW =
      typeof maxW === "number" && maxW > 0
        ? Math.min(maxW, targetW)
        : targetW;
    const wantH =
      typeof maxH === "number" && maxH > 0
        ? Math.min(maxH, targetH)
        : targetH;
    const wantFps =
      typeof maxFps === "number" && maxFps > 0
        ? Math.min(maxFps, targetFps)
        : targetFps;

    const curW = settings.width || 0;
    const curH = settings.height || 0;
    const curFps = settings.frameRate || 0;

    // Đã đủ gần target → bỏ qua
    if (
      curW >= wantW * 0.92 &&
      curH >= wantH * 0.92 &&
      curFps >= Math.min(wantFps, 30) * 0.9
    ) {
      return stream;
    }

    await track.applyConstraints({
      width: { ideal: wantW },
      height: { ideal: wantH },
      frameRate: { ideal: wantFps },
    });
  } catch {
    /* giữ stream hiện tại — không phá cam */
  }
  return stream;
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
  // Android / low-end: denser pinksnow still lite (no heavy glow)
  if (p.isAndroid || p.isLowEnd) {
    return {
      enabled: true,
      intervalMs: isPinkSnow ? 140 : 220,
      maxFlakes: isPinkSnow ? 26 : 12,
      lite: true,
    };
  }
  if (p.isMobile && onCameraRoute) {
    return { enabled: true, intervalMs: 200, maxFlakes: 16, lite: true };
  }

  // Desktop / iOS mạnh — pinksnow denser + multi-layer (premium in GlobalThemeEffects)
  if (onCameraRoute) {
    return {
      enabled: true,
      intervalMs: isPinkSnow ? 120 : 180,
      maxFlakes: isPinkSnow ? 28 : 16,
      lite: false,
    };
  }
  return {
    enabled: true,
    intervalMs: isPinkSnow ? 55 : isPink ? 100 : 130,
    maxFlakes: isPinkSnow ? 68 : isPink ? 36 : 28,
    lite: false,
  };
}
