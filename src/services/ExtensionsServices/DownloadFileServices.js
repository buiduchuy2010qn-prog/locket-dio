import { downloadBlob, shareBlob } from "../BrowserServices";
import {
  applyLocketStyleWatermark,
  ensureJpegFileName,
  isImageBlob,
  isImageFileName,
  isSaveWatermarkEnabled,
} from "@/utils/imageUtils/applyWatermark";

/**
 * Same-origin media download proxy (Railway web / server.mjs).
 * Avoids browser CORS on Firebase / CDN hosts.
 */
function sameOriginProxyUrl(fileUrl) {
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/api/media-download?url=${encodeURIComponent(fileUrl)}`;
  } catch {
    return null;
  }
}

async function tryFetchBlob(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error("Empty blob");
  }
  return blob;
}

/**
 * Last-resort: load remote image into canvas (needs CORS on image host).
 */
async function fetchImageViaCanvas(fileUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          reject(new Error("Image has zero size"));
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          0.95,
        );
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = fileUrl;
  });
}

/**
 * Fetch remote media as Blob with multiple fallbacks.
 * Order: same-origin proxy → media-service → direct CORS → canvas (images).
 */
export async function fetchFileBlob(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") {
    throw new Error("Missing media URL");
  }

  // Local / inline — no network
  if (
    fileUrl.startsWith("blob:") ||
    fileUrl.startsWith("data:") ||
    fileUrl.startsWith("inline://")
  ) {
    if (fileUrl.startsWith("inline://")) {
      throw new Error("Inline media cannot be downloaded");
    }
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error("Local fetch failed");
    return res.blob();
  }

  const errors = [];

  // 1) Same-origin proxy (Railway web / Vercel rewrite → Railway)
  const proxy = sameOriginProxyUrl(fileUrl);
  if (proxy) {
    try {
      return await tryFetchBlob(proxy, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
      });
    } catch (e) {
      errors.push(`proxy: ${e?.message || e}`);
    }
  }

  // 2) Official Dio media-service (POST)
  try {
    return await tryFetchBlob("https://media-service.locket-dio.com/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: fileUrl }),
    });
  } catch (e) {
    errors.push(`media-service: ${e?.message || e}`);
  }

  // 3) Direct CORS fetch
  try {
    return await tryFetchBlob(fileUrl, {
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
    });
  } catch (e) {
    errors.push(`direct: ${e?.message || e}`);
  }

  // 4) Image via canvas (if URL looks like image)
  const looksImage =
    isImageFileName(fileUrl) ||
    /\/(image|img|thumb|photo)/i.test(fileUrl) ||
    !/\.mp4(\?|$)/i.test(fileUrl);

  if (looksImage && typeof document !== "undefined") {
    try {
      return await fetchImageViaCanvas(fileUrl);
    } catch (e) {
      errors.push(`canvas: ${e?.message || e}`);
    }
  }

  console.error("[download] all strategies failed:", errors.join(" | "));
  throw new Error("Download failed");
}

/**
 * Prepare media blob (+ optional watermark) for save/share.
 * @returns {Promise<{ blob: Blob, fileName: string }>}
 */
async function prepareMediaForSave(fileUrl, fileName = "file", opts = {}) {
  let blob = await fetchFileBlob(fileUrl);
  let outName = fileName;

  const wantWm =
    opts.watermark !== undefined
      ? Boolean(opts.watermark)
      : isSaveWatermarkEnabled();
  const asImage =
    isImageBlob(blob) ||
    isImageFileName(fileName) ||
    (!blob.type && isImageFileName(fileName));

  if (wantWm && asImage) {
    blob = await applyLocketStyleWatermark(blob, {
      fileName,
      forceImage: true,
    });
    if (blob.type === "image/jpeg" || !/\.jpe?g$/i.test(outName)) {
      outName = ensureJpegFileName(outName);
    }
  }

  return { blob, fileName: outName };
}

/**
 * Tải thẳng về máy (nút Download). Không mở share sheet.
 *
 * @param {string} fileUrl
 * @param {string} [fileName]
 * @param {() => void} [onReady]
 * @param {{ watermark?: boolean }} [opts]
 */
export async function downloadFileToDevice(
  fileUrl,
  fileName = "file",
  onReady,
  opts = {},
) {
  try {
    const prepared = await prepareMediaForSave(fileUrl, fileName, opts);
    downloadBlob(prepared.blob, prepared.fileName, onReady);
  } catch (err) {
    console.error("Download failed:", err);
    throw err;
  }
}

/**
 * @deprecated Prefer downloadFileToDevice (download) or shareFile (share).
 * Default = download to device (not share sheet).
 */
export async function downloadAndShareFile(
  fileUrl,
  fileName = "file",
  onReady,
  opts = {},
) {
  const mode = opts.mode === "share" ? "share" : "download";
  if (mode === "share") {
    return shareFile(fileUrl, fileName, onReady, opts);
  }
  return downloadFileToDevice(fileUrl, fileName, onReady, opts);
}

/**
 * Mở share sheet (Zalo / Telegram…). Nút Chia sẻ.
 */
export async function shareFile(
  fileUrl,
  fileName = "file",
  onReady,
  opts = {},
) {
  try {
    const prepared = await prepareMediaForSave(fileUrl, fileName, opts);
    await shareBlob(prepared.blob, prepared.fileName, onReady);
  } catch (err) {
    console.error("Share failed:", err);
    throw err;
  }
}
