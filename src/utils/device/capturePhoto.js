/**
 * Fast + sharp still capture for Huy Locket.
 *
 * Priority (snappy first — avoids multi-second takePhoto@48MP):
 *  1) ImageCapture.grabFrame()  — track resolution, usually <100ms
 *  2) <video> → canvas          — Safari / iOS / always works
 *  3) ImageCapture.takePhoto()  — last resort (can be slow on high-MP sensors)
 *
 * Single JPEG encode, center-crop square. Front cam mirrored.
 */

import { getPerfProfile } from "@/utils/device/perfProfile";

const JPEG_Q_FAST = 0.91;
const JPEG_Q_HQ = 0.94;

function maxSideForDevice() {
  const p = getPerfProfile();
  if (p.isLowEnd) return 1440;
  if (p.isMobile || p.isAndroid || p.isIOS) return 1920;
  return 2560;
}

function getLiveTrack(video) {
  try {
    return video?.srcObject?.getVideoTracks?.()?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * Center-crop source to square JPEG.
 */
function cropSourceToSquareJpeg(source, srcW, srcH, opts = {}) {
  const mirror = Boolean(opts.mirror);
  const quality =
    typeof opts.quality === "number"
      ? Math.min(1, Math.max(0.85, opts.quality))
      : JPEG_Q_HQ;
  const maxSide = opts.maxSide || maxSideForDevice();

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
  const ctx = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
    willReadFrequently: false,
  });
  if (!ctx) return Promise.reject(new Error("no 2d context"));

  const needsScale = out !== nativeSide;
  ctx.imageSmoothingEnabled = needsScale;
  if (needsScale) ctx.imageSmoothingQuality = "medium";

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

async function cropBlobToSquareJpeg(blob, opts = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
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

/** grabFrame — nhanh, đủ nét cho feed */
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
        quality: opts.quality ?? JPEG_Q_HQ,
        maxSide: opts.maxSide,
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
 * takePhoto không gọi getPhotoCapabilities (tránh delay + 48MP).
 * Chỉ dùng khi grabFrame/video fail.
 */
async function takePhotoBlobFast(track) {
  if (!track || typeof ImageCapture === "undefined") return null;
  try {
    const ic = new ImageCapture(track);
    const blob = await ic.takePhoto();
    if (blob && blob.size > 1024) return blob;
  } catch {
    /* not supported / busy */
  }
  return null;
}

/**
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
  const maxSide = maxSideForDevice();
  const quality = getPerfProfile().isLowEnd ? JPEG_Q_FAST : JPEG_Q_HQ;

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

  // ── 1) grabFrame (nhanh + nét) ──
  if (track?.readyState === "live") {
    const grabbed = await grabFrameBlob(track, { mirror, quality, maxSide });
    if (grabbed) {
      emitPreview(grabbed);
      return toResult(grabbed, "ImageCapture.grabFrame");
    }
  }

  // ── 2) Video frame — luôn sẵn, 1 encode ──
  if (video.videoWidth && video.readyState >= 2) {
    // 1 rAF để lấy frame mới nhất (không pause stream — tránh giật preview)
    await new Promise((r) => requestAnimationFrame(() => r()));

    const jpeg = await cropSourceToSquareJpeg(
      video,
      video.videoWidth,
      video.videoHeight,
      { mirror, quality, maxSide },
    );
    emitPreview(jpeg);
    return toResult(jpeg, "video.canvas");
  }

  // ── 3) takePhoto fallback (chậm hơn — chỉ khi video chưa ready) ──
  if (track?.readyState === "live") {
    const raw = await takePhotoBlobFast(track);
    if (raw) {
      const jpeg = await cropBlobToSquareJpeg(raw, {
        mirror,
        quality,
        maxSide,
      });
      emitPreview(jpeg);
      return toResult(jpeg, "ImageCapture.takePhoto");
    }
  }

  throw new Error("camera_not_ready");
}
