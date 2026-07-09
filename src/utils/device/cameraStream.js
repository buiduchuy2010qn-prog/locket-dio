/**
 * Open camera stream with progressive fallbacks (mobile-friendly).
 * Never fall back to "any camera" when a facingMode is requested —
 * that silently reopens the front camera and looks like flip failed.
 */

const PREVIEW_LIGHT = {
  width: { ideal: 960, max: 1280 },
  height: { ideal: 720, max: 960 },
  frameRate: { ideal: 20, max: 24 },
};

const PREVIEW_MINIMAL = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 15, max: 24 },
};

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

/**
 * List videoinput devices (request permission if labels empty).
 */
export async function listVideoDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  let devices = await navigator.mediaDevices.enumerateDevices();
  let videos = devices.filter((d) => d.kind === "videoinput");
  if (videos.some((d) => !d.label)) {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      stopMediaStream(tmp);
      devices = await navigator.mediaDevices.enumerateDevices();
      videos = devices.filter((d) => d.kind === "videoinput");
    } catch (_) {
      /* ignore */
    }
  }
  return videos;
}

/**
 * Pick best deviceId for front (user) or back (environment).
 */
export async function resolveDeviceIdForFacing(facingMode = "user") {
  const videos = await listVideoDevices();
  if (!videos.length) return null;

  const frontRe =
    /front|user|mặt trước|trước|facetime|selfie|facing\s*front/i;
  const backRe =
    /back|rear|environment|mặt sau|sau|world|facing\s*back/i;

  const front = [];
  const back = [];
  const unknown = [];

  for (const d of videos) {
    const l = d.label || "";
    if (frontRe.test(l)) front.push(d);
    else if (backRe.test(l)) back.push(d);
    else unknown.push(d);
  }

  if (facingMode === "environment") {
    // Prefer labeled back; avoid tele/ultra for default "back"
    const mainBack =
      back.find(
        (d) =>
          !/ultra|0\.5|tele|zoom|2x|3x|cực rộng|siêu rộng/i.test(d.label || "")
      ) ||
      back[0] ||
      // Many Androids: index 0 = back, 1 = front
      (unknown.length >= 1 ? unknown[0] : null) ||
      (videos.length >= 2 ? videos[0] : null);
    return mainBack?.deviceId || null;
  }

  // user / front
  const mainFront =
    front[0] ||
    (unknown.length >= 2 ? unknown[1] : null) ||
    (videos.length >= 2 ? videos[1] : videos[0]);
  return mainFront?.deviceId || null;
}

async function tryGetUserMedia(videoConstraint) {
  return navigator.mediaDevices.getUserMedia({
    video: videoConstraint,
    audio: false,
  });
}

/**
 * @param {{ facingMode?: string, deviceId?: string | null, zoom?: number | null }} opts
 * @returns {Promise<MediaStream>}
 */
export async function openCameraStream({
  facingMode = "user",
  deviceId = null,
  zoom = null,
} = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Trình duyệt không hỗ trợ camera");
  }

  const mode = facingMode === "environment" ? "environment" : "user";
  const attempts = [];

  const withExtras = (base) => {
    if (zoom != null && zoom > 1 && typeof base === "object") {
      return { ...base, zoom: { ideal: zoom } };
    }
    return base;
  };

  // Resolve deviceId for this facing if not provided
  let resolvedId = deviceId;
  if (!resolvedId) {
    try {
      resolvedId = await resolveDeviceIdForFacing(mode);
    } catch (_) {
      resolvedId = null;
    }
  }

  // 1) Explicit device (best for flip on Android)
  if (resolvedId) {
    attempts.push(
      withExtras({
        deviceId: { exact: resolvedId },
        ...PREVIEW_LIGHT,
      })
    );
    attempts.push({ deviceId: { exact: resolvedId }, ...PREVIEW_MINIMAL });
    attempts.push({ deviceId: { exact: resolvedId } });
    attempts.push({ deviceId: { ideal: resolvedId } });
  }

  // 2) facingMode — do NOT add a final "true" fallback (opens wrong camera)
  attempts.push(
    withExtras({
      facingMode: { exact: mode },
      ...PREVIEW_LIGHT,
    })
  );
  attempts.push({
    facingMode: { exact: mode },
    ...PREVIEW_MINIMAL,
  });
  attempts.push({ facingMode: { exact: mode } });
  attempts.push(
    withExtras({
      facingMode: { ideal: mode },
      ...PREVIEW_LIGHT,
    })
  );
  attempts.push({ facingMode: { ideal: mode }, ...PREVIEW_MINIMAL });
  attempts.push({ facingMode: { ideal: mode } });
  attempts.push({ facingMode: mode });

  // 3) If still failing for environment: try every non-front device
  if (mode === "environment") {
    try {
      const videos = await listVideoDevices();
      const frontRe = /front|user|mặt trước|trước|facetime|selfie/i;
      for (const d of videos) {
        if (frontRe.test(d.label || "")) continue;
        if (d.deviceId === resolvedId) continue;
        attempts.push({ deviceId: { exact: d.deviceId } });
      }
    } catch (_) {
      /* ignore */
    }
  }

  let lastErr;
  for (const video of attempts) {
    try {
      const stream = await tryGetUserMedia(video);
      // Verify facing when possible
      const track = stream.getVideoTracks()[0];
      const settings =
        typeof track?.getSettings === "function" ? track.getSettings() : {};
      if (
        mode === "environment" &&
        settings.facingMode &&
        settings.facingMode === "user" &&
        resolvedId
      ) {
        // Got front by mistake — stop and keep trying
        stopMediaStream(stream);
        continue;
      }
      return stream;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Không mở được camera " + mode);
}
