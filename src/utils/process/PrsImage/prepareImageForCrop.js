/**
 * Chuẩn hóa ảnh client-side → JPEG hiển thị được trên mọi trình duyệt
 * (tránh HEIC/mislabel jpeg, ảnh xám, crop bị disable).
 */

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e || new Error("Image load failed"));
    img.src = url;
  });
}

function canvasToJpegFile(canvas, name = "image.jpg", quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("toBlob failed"));
          return;
        }
        const file = new File([blob], name.replace(/\.[^.]+$/i, ".jpg"), {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        file.__prepared = true;
        resolve(file);
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * @param {File|Blob} file
 * @param {{ maxEdge?: number }} [opts]
 * @returns {Promise<File>}
 */
export async function prepareImageForCrop(file, opts = {}) {
  if (!file) throw new Error("Thiếu file ảnh");
  const maxEdge = opts.maxEdge ?? 2048;

  // 1) createImageBitmap (nhanh, hỗ trợ nhiều format trên mobile)
  let source = null;
  try {
    if (typeof createImageBitmap === "function") {
      source = await createImageBitmap(file);
    }
  } catch {
    source = null;
  }

  // 2) Fallback <img>
  let objectUrl = null;
  if (!source) {
    objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImageFromUrl(objectUrl);
      if (typeof createImageBitmap === "function") {
        try {
          source = await createImageBitmap(img);
        } catch {
          source = img;
        }
      } else {
        source = img;
      }
    } finally {
      // giữ url nếu source là img element vẫn dùng — revoke sau draw
    }
  }

  if (!source) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw new Error("Trình duyệt không đọc được ảnh này");
  }

  const sw = source.naturalWidth || source.width || 0;
  const sh = source.naturalHeight || source.height || 0;
  if (sw < 2 || sh < 2) {
    if (source.close) source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw new Error("Ảnh không hợp lệ (kích thước 0)");
  }

  let w = sw;
  let h = sh;
  if (w > maxEdge || h > maxEdge) {
    const r = Math.min(maxEdge / w, maxEdge / h);
    w = Math.max(1, Math.round(w * r));
    h = Math.max(1, Math.round(h * r));
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    if (source.close) source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    throw new Error("Canvas không khả dụng");
  }
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);

  if (source.close) source.close();
  if (objectUrl) URL.revokeObjectURL(objectUrl);

  const baseName =
    (file.name && String(file.name)) || `locket-${Date.now()}.jpg`;
  return canvasToJpegFile(canvas, baseName, 0.92);
}

/**
 * Kiểm tra browser có decode được file không (không revoke sớm).
 */
export function canBrowserRenderImage(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(false);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    const done = (ok) => {
      URL.revokeObjectURL(url);
      resolve(ok);
    };
    img.onload = () => {
      const ok =
        (img.naturalWidth || 0) > 0 && (img.naturalHeight || 0) > 0;
      done(ok);
    };
    img.onerror = () => done(false);
    // timeout — một số máy treo onload
    setTimeout(() => done(false), 8000);
    img.src = url;
  });
}
