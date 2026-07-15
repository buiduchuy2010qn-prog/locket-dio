/**
 * High-quality still capture for Huy Locket.
 *
 * Priority (sharpest first):
 *  1) ImageCapture.takePhoto() — camera still pipeline (Chrome Android / desktop)
 *  2) ImageCapture.grabFrame()  — full track resolution VideoFrame
 *  3) <video> → canvas          — Safari / iOS fallback
 *
 * Always center-crops to a square at native resolution (no forced 720/1080 downscale).
 * Front camera: horizontal mirror to match the preview.
 */

const JPEG_Q_FINAL = 0.97;
const JPEG_Q_PREVIEW = 0.9;
/** Only cap extreme sensors (e.g. 48MP) to avoid OOM — still far above 1080 */
const ABS_MAX_SIDE = 4096;

function getLiveTrack(video) {
  try {
    return video?.srcObject?.getVideoTracks?.()?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Center-crop source to square JPEG.
 * @param {CanvasImageSource|ImageBitmap} source
 * @param {number} srcW
 * @param {number} srcH
 * @param {{ mirror?: boolean, quality?: number, maxSide?: number }} opts
 * @returns {Promise<Blob>}
 */
function cropSourceToSquareJpeg(source, srcW, srcH, opts = {}) {
  const mirror = Boolean(opts.mirror);
  const quality =
    typeof opts.quality === "number"
      ? Math.min(1, Math.max(0.85, opts.quality))
      : JPEG_Q_FINAL;
  const maxSide = opts.maxSide || ABS_MAX_SIDE;

  if (!srcW || !srcH) {
    return Promise.reject(new Error("invalid dimensions"));
  }

  const nativeSide = Math.min(srcW, srcH);
  const out = Math.min(nativeSide, maxSide);
  const sx = Math.floor((srcW - nativeSide) / 2);
  const sy = Math.floor((srcH - nativeSide) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return Promise.reject(new Error("no 2d context"));

  // 1:1 → no smoothing (keeps fine text sharp)
  const needsScale = out !== nativeSide;
  ctx.imageSmoothingEnabled = needsScale;
  if (needsScale) ctx.imageSmoothingQuality = "high";

  if (mirror) {
    ctx.translate(out, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(source, sx, sy, nativeSide, nativeSide, 0, 0, out, out);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * @param {Blob} blob
 * @param {{ mirror?: boolean, quality?: number, maxSide?: number }} opts
 */
async function cropBlobToSquareJpeg(blob, opts = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    // Fallback decode via Image element
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("image decode failed"));
        el.src = url;
      });
      return cropSourceToSquareJpeg(
        img,
        img.naturalWidth,
        img.naturalHeight,
        opts,
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  try {
    return await cropSourceToSquareJpeg(
      bitmap,
      bitmap.width,
      bitmap.height,
      opts,
    );
  } finally {
    if (typeof bitmap.close === "function") {
      try {
        bitmap.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Try ImageCapture.takePhoto with max photo size when exposed.
 * @param {MediaStreamTrack} track
 * @returns {Promise<Blob|null>}
 */
async function takePhotoBlob(track) {
  if (!track || typeof ImageCapture === "undefined") return null;
  let ic;
  try {
    ic = new ImageCapture(track);
  } catch {
    return null;
  }

  try {
    let settings = {};
    try {
      if (typeof ic.getPhotoCapabilities === "function") {
        const caps = await ic.getPhotoCapabilities();
        if (caps?.imageWidth?.max) settings.imageWidth = caps.imageWidth.max;
        if (caps?.imageHeight?.max) settings.imageHeight = caps.imageHeight.max;
      }
    } catch {
      settings = {};
    }

    const blob =
      Object.keys(settings).length > 0
        ? await ic.takePhoto(settings)
        : await ic.takePhoto();

    if (blob && blob.size > 1024) return blob;
  } catch {
    /* not supported / busy */
  }

  return null;
}

/**
 * @param {MediaStreamTrack} track
 * @param {{ mirror?: boolean }} opts
 * @returns {Promise<Blob|null>}
 */
async function grabFrameBlob(track, opts = {}) {
  if (!track || typeof ImageCapture === "undefined") return null;
  let ic;
  try {
    ic = new ImageCapture(track);
  } catch {
    return null;
  }
  if (typeof ic.grabFrame !== "function") return null;

  try {
    const frame = await ic.grabFrame();
    if (!frame || !frame.width) return null;
    try {
      return await cropSourceToSquareJpeg(frame, frame.width, frame.height, {
        mirror: opts.mirror,
        quality: JPEG_Q_FINAL,
      });
    } finally {
      if (typeof frame.close === "function") {
        try {
          frame.close();
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    return null;
  }
}

/**
 * Capture a sharp square JPEG from the live camera preview.
 *
 * @param {HTMLVideoElement} video
 * @param {{
 *   mirror?: boolean,
 *   onPreviewUrl?: (url: string) => void,
 * }} [opts]
 * @returns {Promise<{ file: File, blob: Blob, method: string }>}
 */
export async function captureSharpSquarePhoto(video, opts = {}) {
  if (!video) throw new Error("no video");
  const mirror = Boolean(opts.mirror);
  const track = getLiveTrack(video);

  const emitPreview = (blob) => {
    if (typeof opts.onPreviewUrl !== "function" || !blob) return;
    try {
      opts.onPreviewUrl(URL.createObjectURL(blob));
    } catch {
      /* ignore */
    }
  };

  const toResult = (blob, method) => ({
    file: new File([blob], "locket_dio.jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    }),
    blob,
    method,
  });

  // ── 1) Full still photo (sharpest — sensor still pipeline) ──
  if (track?.readyState === "live") {
    const raw = await takePhotoBlob(track);
    if (raw) {
      // Light preview first (smaller) then full encode
      try {
        const preview = await cropBlobToSquareJpeg(raw, {
          mirror,
          quality: JPEG_Q_PREVIEW,
          maxSide: 1440,
        });
        emitPreview(preview);
      } catch {
        /* preview optional */
      }

      const jpeg = await cropBlobToSquareJpeg(raw, {
        mirror,
        quality: JPEG_Q_FINAL,
      });
      return toResult(jpeg, "ImageCapture.takePhoto");
    }

    // ── 2) grabFrame at track resolution ──
    const grabbed = await grabFrameBlob(track, { mirror });
    if (grabbed) {
      emitPreview(grabbed);
      return toResult(grabbed, "ImageCapture.grabFrame");
    }
  }

  // ── 3) Video element frame (Safari / iOS / fallback) ──
  if (!video.videoWidth || video.readyState < 2) {
    throw new Error("camera_not_ready");
  }

  try {
    video.pause();
  } catch {
    /* ignore */
  }

  // Commit last decoded frame
  await new Promise((r) => requestAnimationFrame(() => r()));

  const jpeg = await cropSourceToSquareJpeg(
    video,
    video.videoWidth,
    video.videoHeight,
    { mirror, quality: JPEG_Q_FINAL },
  );
  emitPreview(jpeg);
  return toResult(jpeg, "video.canvas");
}
