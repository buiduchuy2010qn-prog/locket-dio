/**
 * Phân loại + chọn camera thiết bị.
 * QUY TẮC CỨNG: zoom 1x → luôn camera chính (main). Không dùng ultra-wide 0.5x.
 */

const ULTRA_RE =
  /cực\s*rộng|ultra\s*wide|ultrawide|ultra\b|0\.5x|góc\s*rộng|wide\s*angle|camera2\s*2|facing\s*back.*ultra|uw\b|siêu\s*rộng|fisheye|fish\s*eye/;
const TELE_RE =
  /chụp\s*xa|tele|telephoto|periscope|\b2x\b|\b3x\b|\b5x\b|\b10x\b|camera2\s*[3-9]/;
const FRONT_RE =
  /mặt\s*trước|front|user|trước|facing\s*front|selfie|camera2\s*1|camera1\s*1/;
const BACK_RE =
  /mặt\s*sau|back|rear|environment|sau|facing\s*back|outer|world|camera2\s*0|camera1\s*0/;
const MAIN_HINT_RE =
  /\b1x\b|main|primary|standard|bình\s*thường|camera\s*kép|\bwide\b(?!\s*angle)|default/;

export const isUltraLabel = (label = "") => ULTRA_RE.test(String(label).toLowerCase());
export const isTeleLabel = (label = "") =>
  TELE_RE.test(String(label).toLowerCase()) && !isUltraLabel(label);

/** Điểm ưu tiên: main 1x cao nhất, ultra/tele phụ thấp hơn */
function scoreBackCamera(device, index, total) {
  const label = (device.label || "").toLowerCase();
  let score = 50;

  if (isUltraLabel(label)) score -= 100;
  else if (isTeleLabel(label)) score -= 25;
  else score += 50; // wide/main mặc định

  if (MAIN_HINT_RE.test(label)) score += 35;

  // camera2 0 thường ultra/logical trên multi-cam Android khi không ghi ultra
  if (total >= 2 && /camera2\s*0\b/.test(label) && !MAIN_HINT_RE.test(label)) {
    score -= 20;
  }
  // camera2 1 / index 1 hay là wide chính
  if (total >= 2 && /camera2\s*1\b/.test(label) && !isUltraLabel(label) && !isTeleLabel(label)) {
    score += 25;
  }
  if (total >= 2 && index === 0 && isUltraLabel(label)) score -= 30;
  if (total >= 2 && index === 1 && !isUltraLabel(label) && !isTeleLabel(label)) {
    score += 20;
  }
  // Multi-cam không label: index 0 hay cam phụ (ultra) → phạt nhẹ
  if (total >= 3 && index === 0 && !MAIN_HINT_RE.test(label) && !isTeleLabel(label)) {
    score -= 15;
  }
  if (total >= 3 && index === total - 1 && isTeleLabel(label)) score -= 5;

  return score;
}

const classifyVideoDevices = (videoDevices) => {
  const frontCameras = [];
  const backCameras = [];

  videoDevices.forEach((device) => {
    const label = (device.label || "").toLowerCase();
    if (FRONT_RE.test(label)) frontCameras.push(device);
    else if (BACK_RE.test(label)) backCameras.push(device);
  });

  const remainingDevices = videoDevices.filter(
    (device) =>
      !frontCameras.some((c) => c.deviceId === device.deviceId) &&
      !backCameras.some((c) => c.deviceId === device.deviceId),
  );

  if (!backCameras.length && remainingDevices.length) {
    if (remainingDevices.length >= 2) {
      // Dual unlabeled: first often front, last back — nhưng đôi khi ngược
      backCameras.push(remainingDevices[remainingDevices.length - 1]);
      if (!frontCameras.length) frontCameras.push(remainingDevices[0]);
    } else {
      backCameras.push(remainingDevices[0]);
    }
  }

  if (!frontCameras.length) {
    const fallbackFront = videoDevices.find(
      (device) => !backCameras.some((c) => c.deviceId === device.deviceId),
    );
    if (fallbackFront) frontCameras.push(fallbackFront);
  }

  let backUltraWideCamera = null;
  let backZoomCamera = null;

  const scored = backCameras.map((device, index) => ({
    device,
    score: scoreBackCamera(device, index, backCameras.length),
    label: (device.label || "").toLowerCase(),
  }));

  for (const item of scored) {
    if (isUltraLabel(item.label) && !backUltraWideCamera) {
      backUltraWideCamera = item.device;
    } else if (isTeleLabel(item.label) && !backZoomCamera) {
      backZoomCamera = item.device;
    }
  }

  // MAIN = điểm cao nhất trong nhóm KHÔNG ultra và KHÔNG tele (1x wide)
  const mainCandidates = scored.filter(
    (s) => !isUltraLabel(s.label) && !isTeleLabel(s.label),
  );
  const mainPool = (
    mainCandidates.length
      ? mainCandidates
      : scored.filter((s) => !isUltraLabel(s.label))
  ).slice();
  mainPool.sort((a, b) => b.score - a.score);
  const backNormalCamera = mainPool[0]?.device || backCameras[0] || null;

  if (!backUltraWideCamera) {
    const ultraOnly = scored.filter((s) => isUltraLabel(s.label));
    if (ultraOnly.length) {
      ultraOnly.sort((a, b) => a.score - b.score);
      const cand = ultraOnly[0];
      if (cand.device.deviceId !== backNormalCamera?.deviceId) {
        backUltraWideCamera = cand.device;
      }
    }
  }

  // Nếu không detect ultra bằng label: trên multi-back, cam điểm thấp nhất (khác main/tele) ≈ ultra
  if (!backUltraWideCamera && scored.length >= 2 && backNormalCamera) {
    const others = scored
      .filter(
        (s) =>
          s.device.deviceId !== backNormalCamera.deviceId &&
          s.device.deviceId !== backZoomCamera?.deviceId,
      )
      .sort((a, b) => a.score - b.score);
    if (others.length && others[0].score < 40) {
      backUltraWideCamera = others[0].device;
    }
  }

  return {
    allCameras: videoDevices,
    frontCameras,
    backCameras,
    backUltraWideCamera,
    backNormalCamera,
    backZoomCamera,
  };
};

/** Cache enumerate — tránh enumerateDevices + getUserMedia mỗi lần đổi lens */
let camerasCache = null;
let camerasCacheAt = 0;
const CAMERAS_CACHE_MS = 90 * 1000;

export const invalidateCameraCache = () => {
  camerasCache = null;
  camerasCacheAt = 0;
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

  const devices = await navigator.mediaDevices.enumerateDevices();
  let videoDevices = devices.filter((d) => d.kind === "videoinput");
  const hasLabels = videoDevices.some((device) => device.label);

  if (!hasLabels) {
    // Chỉ xin quyền 1 lần khi chưa có label — rồi cache
    const permissionStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });
    try {
      const refreshed = await navigator.mediaDevices.enumerateDevices();
      videoDevices = refreshed.filter((d) => d.kind === "videoinput");
    } finally {
      permissionStream.getTracks().forEach((t) => t.stop());
    }
  }

  camerasCache = classifyVideoDevices(videoDevices);
  camerasCacheAt = Date.now();
  return camerasCache;
};

/**
 * Trả về deviceId theo mode + zoom.
 * 1x (mặc định) → LUÔN camera chính. Không bao giờ ultra.
 *
 * @param {"user"|"environment"} mode
 * @param {"0.5x"|"1x"|"2x"|"3x"|string} [zoomLevel="1x"]
 */
export const pickCameraDeviceId = async (mode, zoomLevel = "1x") => {
  try {
    const cameras = await getAvailableCameras();
    if (mode === "user") {
      return cameras?.frontCameras?.[0]?.deviceId || null;
    }

    // 1x = LUÔN main wide — không bao giờ ultra / tele / backCameras[0] mù quáng
    const mainId =
      cameras?.backNormalCamera?.deviceId ||
      cameras?.backCameras?.find(
        (c) => !isUltraLabel(c.label) && !isTeleLabel(c.label),
      )?.deviceId ||
      cameras?.backCameras?.find((c) => !isUltraLabel(c.label))?.deviceId ||
      null;

    const z = String(zoomLevel || "1x").toLowerCase();

    // 0.5x: ultra nếu có, không thì main (digital không được thì vẫn main)
    if (z === "0.5x" || z === "0.5") {
      return cameras?.backUltraWideCamera?.deviceId || mainId;
    }

    // 2x / 3x / 5x: tele nếu có, không thì main + digital zoom
    if (z === "2x" || z === "3x" || z === "5x") {
      return cameras?.backZoomCamera?.deviceId || mainId;
    }

    // 1x và mọi trường hợp khác → BẮT BUỘC main
    return mainId;
  } catch (e) {
    console.warn("pickCameraDeviceId:", e.message);
    return null;
  }
};

/** deviceId có phải ultra-wide không (theo label đã enumerate) */
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

/**
 * deviceId bắt buộc dùng ở zoom 1x (camera chính).
 * Dùng khi cần ép lại sau khi browser chọn sai.
 */
export const getMainBackCameraId = async () => {
  const cameras = await getAvailableCameras();
  return (
    cameras?.backNormalCamera?.deviceId ||
    cameras?.backCameras?.find(
      (c) => !isUltraLabel(c.label) && !isTeleLabel(c.label),
    )?.deviceId ||
    cameras?.backCameras?.find((c) => !isUltraLabel(c.label))?.deviceId ||
    null
  );
};
