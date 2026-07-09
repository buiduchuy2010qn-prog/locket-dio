/**
 * Enumerate and classify phone cameras (front / ultra-wide / main / tele).
 * Labels vary a lot by OEM (Samsung, Xiaomi, Pixel, Oppo, iPhone…).
 */

const FRONT_RE =
  /mặt trước|front|user|trước|facing\s*front|facing:\s*front|facetime|selfie/i;
const BACK_RE =
  /mặt sau|back|rear|environment|sau|facing\s*back|facing:\s*back|world/i;

// Ultra-wide / 0.5x — as many OEM strings as possible
const ULTRA_RE =
  /cực\s*rộng|siêu\s*rộng|góc\s*rộng|ultra\s*-?\s*wide|ultrawide|uwide|\buw\b|0\s*\.?\s*5\s*x|0,5\s*x|wide\s*angle|wideangle|camera2\s*2|logical.?camera.?id.?2|macro/i;

const TELE_RE =
  /chụp\s*xa|tele\s*photo|telephoto|\btele\b|periscope|2\s*x|3\s*x|5\s*x|10\s*x|zoom\s*camera|camera2\s*[34]/i;

const MAIN_RE =
  /bình\s*thường|chính|\bmain\b|1\s*x|primary|wide(?!\s*angle)|camera\s*kép|dual|camera2\s*0/i;

function classifyLabel(label) {
  const l = (label || "").toLowerCase();
  return {
    isFront: FRONT_RE.test(l) && !BACK_RE.test(l),
    isBack: BACK_RE.test(l),
    isUltra: ULTRA_RE.test(l),
    isTele: TELE_RE.test(l) && !ULTRA_RE.test(l),
    isMain: MAIN_RE.test(l) && !ULTRA_RE.test(l) && !TELE_RE.test(l),
  };
}

export const getAvailableCameras = async () => {
  let devices = await navigator.mediaDevices.enumerateDevices();
  let videoDevices = devices.filter((d) => d.kind === "videoinput");

  // Need labels → request permission briefly
  if (videoDevices.some((d) => !d.label)) {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      tmp.getTracks().forEach((t) => t.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices.filter((d) => d.kind === "videoinput");
    } catch (_) {
      try {
        const tmp = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        tmp.getTracks().forEach((t) => t.stop());
        devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter((d) => d.kind === "videoinput");
      } catch (__) {
        /* ignore */
      }
    }
  }

  const frontCameras = [];
  const backCameras = [];
  const ultraCandidates = [];
  const teleCandidates = [];
  const mainCandidates = [];

  videoDevices.forEach((device, index) => {
    const label = device.label || "";
    const c = classifyLabel(label);

    if (c.isFront) {
      frontCameras.push(device);
      return;
    }

    // Treat as back if labeled back OR unknown (most multi-cams are back)
    const asBack = c.isBack || !c.isFront;
    if (asBack) {
      backCameras.push(device);
    }

    if (c.isUltra) {
      ultraCandidates.push(device);
    } else if (c.isTele) {
      teleCandidates.push(device);
    } else if (c.isMain || c.isBack) {
      mainCandidates.push(device);
    }
  });

  // --- Heuristics when labels are weak (common on Android WebView/Chrome) ---
  // Order is often: 0=main/back, 1=front OR ultra, 2=ultra/tele
  if (!mainCandidates.length && backCameras.length) {
    mainCandidates.push(backCameras[0]);
  }

  if (!ultraCandidates.length && backCameras.length >= 2) {
    // Prefer later indices for ultra-wide on many Androids (camera2 2)
    const guess =
      backCameras.find((d, i) => i >= 1 && !teleCandidates.includes(d)) ||
      backCameras[backCameras.length - 1];
    if (guess && guess !== mainCandidates[0]) {
      ultraCandidates.push(guess);
    }
  }

  // If only "Camera 0, Camera 1, Camera 2" style — index 0 main, 2 ultra often
  if (!ultraCandidates.length && videoDevices.length >= 3) {
    const byIndex = videoDevices.filter((d) => {
      const l = (d.label || "").toLowerCase();
      return !FRONT_RE.test(l);
    });
    if (byIndex.length >= 2) {
      ultraCandidates.push(byIndex[byIndex.length - 1]);
    }
  }

  if (!frontCameras.length) {
    videoDevices.forEach((d) => {
      if (FRONT_RE.test(d.label || "")) frontCameras.push(d);
    });
    // Still empty: leave empty (desktop)
  }

  const backUltraWideCamera = ultraCandidates[0] || null;
  const backNormalCamera =
    mainCandidates[0] || backCameras[0] || null;
  const backZoomCamera = teleCandidates[0] || null;

  // All ultra candidates (for fallback if first deviceId fails open)
  const ultraWideDeviceIds = [
    ...new Set(ultraCandidates.map((d) => d.deviceId).filter(Boolean)),
  ];

  return {
    allCameras: videoDevices,
    frontCameras,
    backCameras,
    backUltraWideCamera,
    backNormalCamera,
    backZoomCamera,
    backTeleCamera: backZoomCamera,
    ultraWideDeviceIds,
    hasUltraWide: Boolean(backUltraWideCamera || ultraWideDeviceIds.length),
  };
};

/**
 * Try opening each ultra-wide candidate; return first working deviceId.
 * Optional: prefer facingMode environment only as last resort (not true 0.5).
 */
export async function resolveUltraWideDeviceId(cameras) {
  const ids = [];
  if (cameras?.backUltraWideCamera?.deviceId) {
    ids.push(cameras.backUltraWideCamera.deviceId);
  }
  for (const id of cameras?.ultraWideDeviceIds || []) {
    if (!ids.includes(id)) ids.push(id);
  }
  // Other back cams except main (might be UW)
  const mainId = cameras?.backNormalCamera?.deviceId;
  for (const d of cameras?.backCameras || []) {
    if (d.deviceId !== mainId && !ids.includes(d.deviceId)) {
      ids.push(d.deviceId);
    }
  }

  for (const deviceId of ids) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });
      stream.getTracks().forEach((t) => t.stop());
      return deviceId;
    } catch (_) {
      /* try next */
    }
  }
  return null;
}
