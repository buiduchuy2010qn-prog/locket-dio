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

const FRONT_RE =
  /front|user|mặt trước|trước|facetime|selfie|facing\s*front|facing:\s*front/i;
const BACK_RE =
  /back|rear|environment|mặt sau|sau|world|facing\s*back|facing:\s*back/i;

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
 * Prefer not thrashing the camera: only probe if labels are missing.
 */
export async function listVideoDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  let devices = await navigator.mediaDevices.enumerateDevices();
  let videos = devices.filter((d) => d.kind === "videoinput");
  if (videos.some((d) => !d.label)) {
    try {
      // Prefer environment probe so labels favor rear when possible
      let tmp;
      try {
        tmp = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (_) {
        tmp = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      stopMediaStream(tmp);
      // Give OS time to release after label probe
      await new Promise((r) => setTimeout(r, 120));
      devices = await navigator.mediaDevices.enumerateDevices();
      videos = devices.filter((d) => d.kind === "videoinput");
    } catch (_) {
      /* ignore */
    }
  }
  return videos;
}

function classifyDevice(device) {
  const l = device?.label || "";
  if (FRONT_RE.test(l) && !BACK_RE.test(l)) return "front";
  if (BACK_RE.test(l)) return "back";
  return "unknown";
}

/**
 * Pick best deviceId for front (user) or back (environment).
 */
export async function resolveDeviceIdForFacing(facingMode = "user") {
  const videos = await listVideoDevices();
  if (!videos.length) return null;

  const front = [];
  const back = [];
  const unknown = [];

  for (const d of videos) {
    const kind = classifyDevice(d);
    if (kind === "front") front.push(d);
    else if (kind === "back") back.push(d);
    else unknown.push(d);
  }

  if (facingMode === "environment") {
    // Prefer labeled back; avoid tele/ultra for default "back"
    const mainBack =
      back.find(
        (d) =>
          !/ultra|0\.5|tele|zoom|2x|3x|cực rộng|siêu rộng|uw\b/i.test(
            d.label || ""
          )
      ) ||
      back[0] ||
      // Many Androids: index 0 = back main when unlabeled
      (unknown.length >= 1 ? unknown[0] : null) ||
      // Fallback: first non-front
      videos.find((d) => classifyDevice(d) !== "front") ||
      null;
    return mainBack?.deviceId || null;
  }

  // user / front
  const mainFront =
    front[0] ||
    (unknown.length >= 2 ? unknown[1] : null) ||
    (videos.length >= 2 ? videos[1] : videos[0]);
  return mainFront?.deviceId || null;
}

/**
 * If caller passes a deviceId that clearly belongs to the wrong facing,
 * ignore it so we don't open front while requesting environment.
 */
async function sanitizeDeviceId(deviceId, mode) {
  if (!deviceId) return null;
  try {
    const videos = await listVideoDevices();
    const d = videos.find((v) => v.deviceId === deviceId);
    if (!d) return deviceId; // unknown id — still try
    const kind = classifyDevice(d);
    if (mode === "environment" && kind === "front") return null;
    if (mode === "user" && kind === "back") return null;
    return deviceId;
  } catch (_) {
    return deviceId;
  }
}

async function tryGetUserMedia(videoConstraint) {
  return navigator.mediaDevices.getUserMedia({
    video: videoConstraint,
    audio: false,
  });
}

function trackFacing(stream) {
  try {
    const track = stream?.getVideoTracks?.()?.[0];
    const settings =
      typeof track?.getSettings === "function" ? track.getSettings() : {};
    return {
      facingMode: settings.facingMode || null,
      deviceId: settings.deviceId || null,
      label: track?.label || "",
    };
  } catch (_) {
    return { facingMode: null, deviceId: null, label: "" };
  }
}

/** Reject stream if we can prove it opened the wrong facing. */
function isWrongFacing(stream, mode) {
  const info = trackFacing(stream);
  if (mode === "environment") {
    if (info.facingMode === "user") return true;
    if (info.label && FRONT_RE.test(info.label) && !BACK_RE.test(info.label)) {
      return true;
    }
  }
  if (mode === "user") {
    if (info.facingMode === "environment") return true;
    if (info.label && BACK_RE.test(info.label) && !FRONT_RE.test(info.label)) {
      return true;
    }
  }
  return false;
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

  // Drop deviceId if it belongs to the opposite camera
  let resolvedId = await sanitizeDeviceId(deviceId, mode);
  if (!resolvedId) {
    try {
      resolvedId = await resolveDeviceIdForFacing(mode);
    } catch (_) {
      resolvedId = null;
    }
  }

  // Order tuned for mobile flip reliability:
  // - facingMode first (browser picks correct lens; works well on iOS/Chrome)
  // - then explicit deviceId (helps Android multi-cam)
  // - then other non-front devices for environment

  // 1) facingMode variants
  attempts.push(
    withExtras({
      facingMode: { exact: mode },
      ...PREVIEW_LIGHT,
    })
  );
  attempts.push({ facingMode: { exact: mode }, ...PREVIEW_MINIMAL });
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

  // 2) Explicit device
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
    // deviceId + facingMode together (some Chromium builds need both)
    attempts.push({
      deviceId: { exact: resolvedId },
      facingMode: { ideal: mode },
    });
  }

  // 3) Environment: try every non-front device
  if (mode === "environment") {
    try {
      const videos = await listVideoDevices();
      for (const d of videos) {
        if (classifyDevice(d) === "front") continue;
        if (d.deviceId === resolvedId) continue;
        attempts.push({ deviceId: { exact: d.deviceId } });
        attempts.push({
          deviceId: { exact: d.deviceId },
          facingMode: { ideal: "environment" },
        });
      }
    } catch (_) {
      /* ignore */
    }
  }

  let lastErr;
  for (const video of attempts) {
    try {
      const stream = await tryGetUserMedia(video);
      if (isWrongFacing(stream, mode)) {
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
