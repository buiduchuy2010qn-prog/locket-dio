/**
 * Enumerate and classify phone cameras (front / ultra-wide / main / tele).
 */
export const getAvailableCameras = async () => {
  let devices = await navigator.mediaDevices.enumerateDevices();
  let videoDevices = devices.filter((d) => d.kind === "videoinput");
  const needPermission = videoDevices.some((d) => !d.label);
  if (needPermission) {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      tmp.getTracks().forEach((t) => t.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices.filter((d) => d.kind === "videoinput");
    } catch (_) {
      /* ignore */
    }
  }

  const frontCameras = [];
  const backCameras = [];

  let backUltraWideCamera = null;
  let backNormalCamera = null;
  let backZoomCamera = null;
  let backTeleCamera = null;

  videoDevices.forEach((device) => {
    const label = (device.label || "").toLowerCase();

    const isFront =
      /mặt trước|front|user|trước|facing front|facing: front/.test(label) ||
      /camera2 1/.test(label);
    const isBack =
      /mặt sau|back|rear|environment|sau|facing back|facing: back/.test(
        label
      ) || /camera2 0/.test(label);

    if (isFront && !isBack) {
      frontCameras.push(device);
      return;
    }

    if (isBack || (!isFront && label)) {
      // Default unlabeled extras after first often back on Android
      if (!isFront) backCameras.push(device);

      if (
        /cực rộng|ultra.?wide|ultrawide|0\.5x|góc rộng|wide angle|camera2 2/.test(
          label
        )
      ) {
        backUltraWideCamera ??= device;
      } else if (
        /chụp xa|tele|telephoto|zoom|2x|3x|5x|periscope|camera2 3|camera2 4/.test(
          label
        )
      ) {
        backZoomCamera ??= device;
        backTeleCamera ??= device;
      } else if (
        isBack ||
        /camera kép|bình thường|1x|wide|chính|main|dual/.test(label)
      ) {
        if (
          !/cực rộng|ultra|tele|zoom|0\.5|chụp xa/.test(label) ||
          /1x|main|chính|wide(?! angle)/.test(label)
        ) {
          backNormalCamera ??= device;
        }
      }
    }
  });

  // Heuristic when labels empty/generic (Android often "camera 0,1,2")
  if (!backNormalCamera && backCameras.length) {
    backNormalCamera = backCameras[0];
  }
  if (!backUltraWideCamera && backCameras.length >= 2) {
    // Often index 1 or 2 is ultra-wide
    backUltraWideCamera = backCameras[1] || backCameras[backCameras.length - 1];
  }
  if (!backZoomCamera && backCameras.length >= 3) {
    backZoomCamera = backCameras[2];
    backTeleCamera = backCameras[2];
  }
  if (!frontCameras.length) {
    // Last resort: first non-back
    videoDevices.forEach((d) => {
      if (!backCameras.find((b) => b.deviceId === d.deviceId)) {
        frontCameras.push(d);
      }
    });
  }

  return {
    allCameras: videoDevices,
    frontCameras,
    backCameras,
    backUltraWideCamera,
    backNormalCamera,
    backZoomCamera,
    backTeleCamera: backTeleCamera || backZoomCamera,
  };
};
