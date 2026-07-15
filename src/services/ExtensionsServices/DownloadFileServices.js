import { downloadBlob, shareBlob } from "../BrowserServices";
import {
  applyLocketStyleWatermark,
  ensureJpegFileName,
  isImageBlob,
  isImageFileName,
  isSaveWatermarkEnabled,
} from "@/utils/imageUtils/applyWatermark";

export async function fetchFileBlob(fileUrl) {
  // Prefer media proxy (avoids CORS / auth on Firebase URLs)
  try {
    const res = await fetch("https://media-service.locket-dio.com/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: fileUrl }),
    });

    if (res.ok) {
      return await res.blob();
    }
  } catch (e) {
    console.warn("[download] media-service failed, direct fetch:", e?.message);
  }

  // Fallback: direct fetch (may fail CORS for some hosts)
  const direct = await fetch(fileUrl, { mode: "cors", credentials: "omit" });
  if (!direct.ok) {
    throw new Error("Download failed");
  }
  return await direct.blob();
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
