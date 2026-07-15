export async function shareData(data) {
  if (!navigator.share) {
    throw new Error("Web Share API not supported");
  }

  try {
    await navigator.share(data);
    return true;
  } catch (err) {
    console.error("Share failed:", err);
    return false;
  }
}

/**
 * Tải file thẳng về máy (không mở share sheet).
 * Nút Download phải dùng hàm này — không dùng navigator.share.
 *
 * @param {Blob|File} blob
 * @param {string} [fileName]
 * @param {() => void} [onReady]
 */
export function downloadBlob(blob, fileName = "file", onReady) {
  if (!blob) throw new Error("No blob to download");

  const mimeType = blob.type || "application/octet-stream";
  if (!String(fileName).includes(".")) {
    const ext = mimeType.split("/")[1] || "dat";
    fileName = `${fileName}.${ext}`;
  }

  if (typeof onReady === "function") onReady();

  // Legacy Edge / IE
  if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
    navigator.msSaveOrOpenBlob(blob, fileName);
    return;
  }

  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // delay revoke so browser can start download
  setTimeout(() => {
    try {
      a.remove();
    } catch {
      /* ignore */
    }
    URL.revokeObjectURL(blobUrl);
  }, 2000);
}

/**
 * Share sheet (Zalo / Telegram / …). Dùng cho nút Chia sẻ, không phải nút Tải.
 */
export async function shareBlob(blob, fileName = "file", onReady) {
  const mimeType = blob.type || "application/octet-stream";

  if (!String(fileName).includes(".")) {
    const ext = mimeType.split("/")[1] || "dat";
    fileName = `${fileName}.${ext}`;
  }

  const file = new File([blob], fileName, { type: mimeType });

  if (typeof onReady === "function") onReady();

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: mimeType.startsWith("video") ? "Share video" : "Share image",
      });
      return;
    } catch (err) {
      // User cancel → không fallback download
      if (err?.name === "AbortError") return;
      console.warn("Share failed, fallback download:", err?.message);
    }
  }

  // Fallback: tải về máy
  downloadBlob(blob, fileName);
}
