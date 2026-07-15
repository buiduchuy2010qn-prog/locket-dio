import { shareBlob } from "../BrowserServices";
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
 * Download / share with Locket-style watermark on images.
 * Videos pass through unchanged.
 *
 * @param {string} fileUrl
 * @param {string} [fileName]
 * @param {() => void} [onReady]
 * @param {{ watermark?: boolean }} [opts]
 */
export async function downloadAndShareFile(
  fileUrl,
  fileName = "file",
  onReady,
  opts = {},
) {
  try {
    let blob = await fetchFileBlob(fileUrl);
    let outName = fileName;

    // opts.watermark overrides menu setting; default = user menu on/off
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
      // Watermark path exports JPEG
      if (blob.type === "image/jpeg" || !/\.jpe?g$/i.test(outName)) {
        outName = ensureJpegFileName(outName);
      }
    }

    await shareBlob(blob, outName, onReady);
  } catch (err) {
    console.error("Download/share failed:", err);
    throw err;
  }
}
