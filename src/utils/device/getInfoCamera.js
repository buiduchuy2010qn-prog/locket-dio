/**
 * Phân loại camera thiết bị.
 * Ưu tiên ống kính chính (1x) — tránh ultra-wide 0.5x khi bật camera sau.
 */

const ULTRA_RE =
  /cực\s*rộng|ultra\s*wide|ultrawide|0\.5x|góc\s*rộng|wide\s*angle|camera2\s*2|facing\s*back.*ultra|uw\b|siêu\s*rộng/;
const TELE_RE =
  /chụp\s*xa|tele|telephoto|zoom|2x|3x|5x|periscope|camera2\s*[3-9]/;
const FRONT_RE =
  /mặt\s*trước|front|user|trước|facing\s*front|selfie|camera2\s*1|camera1\s*1/;
const BACK_RE =
  /mặt\s*sau|back|rear|environment|sau|facing\s*back|outer|world|camera2\s*0|camera1\s*0/;

const isUltra = (label) => ULTRA_RE.test(label);
const isTele = (label) => TELE_RE.test(label) && !isUltra(label);

/** Điểm ưu tiên: normal 1x cao nhất, ultra thấp nhất */
function scoreBackCamera(device, index, total) {
  const label = (device.label || "").toLowerCase();
  let score = 50;

  if (isUltra(label)) score -= 40;
  else if (isTele(label)) score -= 10;
  else score += 30; // lens chính / wide bình thường

  // Label gợi ý 1x / main / dual / wide (không ultra)
  if (/\b1x\b|main|primary|standard|bình\s*thường|camera\s*kép|wide(?!\s*angle)/.test(label)) {
    score += 20;
  }

  // Nhiều máy Android: camera sau chính thường không phải index 0 (0 = ultra)
  // Ưu tiên nhẹ camera ở giữa danh sách back
  if (total >= 2 && index === 0 && isUltra(label)) score -= 15;
  if (total >= 2 && index === 1 && !isUltra(label) && !isTele(label)) score += 15;

  return score;
}

const classifyVideoDevices = (videoDevices) => {
  const frontCameras = [];
  const backCameras = [];

  videoDevices.forEach((device) => {
    const label = (device.label || "").toLowerCase();

    if (FRONT_RE.test(label)) {
      frontCameras.push(device);
    } else if (BACK_RE.test(label)) {
      backCameras.push(device);
    }
  });

  const remainingDevices = videoDevices.filter(
    (device) =>
      !frontCameras.some((c) => c.deviceId === device.deviceId) &&
      !backCameras.some((c) => c.deviceId === device.deviceId),
  );

  // Không gắn nhãn: gán phần còn lại (mobile thường front rồi back)
  if (!backCameras.length && remainingDevices.length) {
    // Prefer last remaining as back on dual-cam mobile
    if (remainingDevices.length >= 2) {
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

  // Phân loại back theo label + điểm
  let backUltraWideCamera = null;
  let backZoomCamera = null;
  let backNormalCamera = null;

  const scored = backCameras.map((device, index) => ({
    device,
    score: scoreBackCamera(device, index, backCameras.length),
    label: (device.label || "").toLowerCase(),
  }));

  for (const item of scored) {
    if (isUltra(item.label) && !backUltraWideCamera) {
      backUltraWideCamera = item.device;
    } else if (isTele(item.label) && !backZoomCamera) {
      backZoomCamera = item.device;
    }
  }

  // Normal = điểm cao nhất trong các camera KHÔNG phải ultra (ưu tiên)
  const nonUltra = scored.filter((s) => !isUltra(s.label));
  const pool = nonUltra.length ? nonUltra : scored;
  pool.sort((a, b) => b.score - a.score);
  backNormalCamera = pool[0]?.device || backCameras[0] || null;

  // Nếu normal vẫn trùng ultra (chỉ có 1 camera), giữ nguyên
  // Nếu ultra chưa gán: lấy camera có label ultra hoặc score thấp nhất
  if (!backUltraWideCamera) {
    const ultraCandidate = [...scored].sort((a, b) => a.score - b.score)[0];
    if (
      ultraCandidate &&
      backNormalCamera &&
      ultraCandidate.device.deviceId !== backNormalCamera.deviceId &&
      isUltra(ultraCandidate.label)
    ) {
      backUltraWideCamera = ultraCandidate.device;
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

export const getAvailableCameras = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  let videoDevices = devices.filter((d) => d.kind === "videoinput");
  const hasLabels = videoDevices.some((device) => device.label);

  if (!hasLabels) {
    const permissionStream = await navigator.mediaDevices.getUserMedia({
      video: true,
    });

    try {
      const refreshedDevices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = refreshedDevices.filter((d) => d.kind === "videoinput");
    } finally {
      permissionStream.getTracks().forEach((track) => track.stop());
    }
  }

  return classifyVideoDevices(videoDevices);
};

/**
 * Chọn deviceId phù hợp khi bật camera (mặc định lens chính 1x).
 * @param {"user"|"environment"} mode
 * @param {"0.5x"|"1x"|"2x"|"3x"} [zoomLevel="1x"]
 */
export const pickCameraDeviceId = async (mode, zoomLevel = "1x") => {
  try {
    const cameras = await getAvailableCameras();
    if (mode === "user") {
      return cameras?.frontCameras?.[0]?.deviceId || null;
    }

    // Back camera
    if (zoomLevel === "0.5x") {
      return (
        cameras?.backUltraWideCamera?.deviceId ||
        cameras?.backNormalCamera?.deviceId ||
        cameras?.backCameras?.[0]?.deviceId ||
        null
      );
    }
    if (zoomLevel === "2x" || zoomLevel === "3x") {
      return (
        cameras?.backZoomCamera?.deviceId ||
        cameras?.backNormalCamera?.deviceId ||
        cameras?.backCameras?.[0]?.deviceId ||
        null
      );
    }

    // 1x — luôn lens chính, không ultra
    return (
      cameras?.backNormalCamera?.deviceId ||
      cameras?.backCameras?.find((c) => {
        const l = (c.label || "").toLowerCase();
        return !isUltra(l);
      })?.deviceId ||
      cameras?.backCameras?.[0]?.deviceId ||
      null
    );
  } catch (e) {
    console.warn("pickCameraDeviceId:", e.message);
    return null;
  }
};
