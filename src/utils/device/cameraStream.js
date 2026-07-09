/**
 * Open camera stream with progressive fallbacks (mobile-friendly).
 * Prefer moderate resolution for smooth preview; avoid exact constraints that fail.
 */

const PREVIEW_IDEAL = {
  width: { ideal: 1280, max: 1920 },
  height: { ideal: 720, max: 1080 },
  frameRate: { ideal: 24, max: 30 },
};

/**
 * @param {{ facingMode?: string, deviceId?: string | null }} opts
 * @returns {Promise<MediaStream>}
 */
export async function openCameraStream({
  facingMode = "user",
  deviceId = null,
} = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Trình duyệt không hỗ trợ camera");
  }

  const attempts = [];

  // 1) Specific device (zoom lens) — no facingMode conflict
  if (deviceId) {
    attempts.push({
      deviceId: { exact: deviceId },
      ...PREVIEW_IDEAL,
    });
    attempts.push({ deviceId: { exact: deviceId } });
  }

  // 2) Facing mode exact + ideal res
  attempts.push({
    facingMode: { exact: facingMode },
    ...PREVIEW_IDEAL,
  });

  // 3) Facing mode ideal (more compatible)
  attempts.push({
    facingMode: { ideal: facingMode },
    ...PREVIEW_IDEAL,
  });

  // 4) Facing mode only (legacy string)
  attempts.push({ facingMode });

  // 5) Any camera
  attempts.push(true);

  let lastErr;
  for (const video of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio: false,
      });
      return stream;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Không mở được camera");
}

/** Stop all tracks on a stream */
export function stopMediaStream(stream) {
  if (!stream) return;
  try {
    stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch (_) {
        /* ignore */
      }
    });
  } catch (_) {
    /* ignore */
  }
}
