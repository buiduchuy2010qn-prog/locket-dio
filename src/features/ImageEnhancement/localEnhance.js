/**
 * On-device ESRGAN Slim 2x via UpscalerJS — runs inside existing AI Làm nét modal.
 * Dynamic-import only — never loaded at app boot or camera open.
 * Model weights: same-origin /ai-models/esrgan-slim-2x/v1/ (Vercel + Railway).
 * Free path never calls Railway API / Replicate and never uploads the image.
 * Does not touch camera/music modules.
 */
import {
  LOCAL_MODEL_ID,
  LOCAL_MODEL_JSON_PATH,
  LOCAL_MAX_OUTPUT_EDGE,
  LOCAL_PATCH_SIZE,
  LOCAL_PATCH_PADDING,
  ENHANCE_UI,
} from "./constants";
import { assertEnhanceableFile } from "./validateClient";

/** @type {import('upscaler').default | null} */
let upscalerInstance = null;
/** @type {Promise<import('upscaler').default> | null} */
let loadPromise = null;
let modelReady = false;

export function isLocalModelReady() {
  return modelReady;
}

/**
 * Absolute same-origin URL for model.json.
 * Uses window.location.origin — never hard-codes Vercel/Railway domain.
 */
export function getLocalModelJsonUrl() {
  const path = LOCAL_MODEL_JSON_PATH || "/ai-models/esrgan-slim-2x/v1/model.json";
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(path, window.location.origin).href;
  }
  return path;
}

/**
 * Best-effort: model weights already in Cache Storage (same-origin static).
 */
export async function isLocalModelLikelyCached() {
  if (modelReady) return true;
  if (typeof caches === "undefined") return false;
  const marker = "/ai-models/esrgan-slim-2x/";
  try {
    const keys = await caches.keys();
    for (const name of keys) {
      const cache = await caches.open(name);
      const reqs = await cache.keys();
      if (
        reqs.some(
          (r) =>
            r.url.includes(marker) &&
            (r.url.includes("model.json") || r.url.includes("group1-shard")),
        )
      ) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

async function getUpscaler() {
  if (upscalerInstance) return upscalerInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    // Dynamic: keeps TF.js + Upscaler out of boot / camera entry
    const [{ default: Upscaler }, { default: x2 }] = await Promise.all([
      import("upscaler"),
      import("@upscalerjs/esrgan-slim/2x"),
    ]);
    try {
      await import("@tensorflow/tfjs");
    } catch {
      /* peer pulled by upscaler */
    }

    // Force same-origin static weights — never jsDelivr/unpkg CDN
    const modelPath = getLocalModelJsonUrl();
    const instance = new Upscaler({
      model: {
        ...x2,
        path: modelPath,
      },
    });
    upscalerInstance = instance;
    modelReady = true;
    return instance;
  })();

  try {
    return await loadPromise;
  } catch (e) {
    loadPromise = null;
    modelReady = false;
    throw e;
  }
}

/**
 * Dispose Upscaler + clear singleton (call when leaving editor / unmount).
 */
export async function disposeLocalEnhancer() {
  const inst = upscalerInstance;
  upscalerInstance = null;
  loadPromise = null;
  modelReady = false;
  if (!inst) return;
  try {
    inst.abort();
  } catch {
    /* ignore */
  }
  try {
    await inst.dispose();
  } catch {
    /* ignore */
  }
}

export function abortLocalEnhancer() {
  try {
    upscalerInstance?.abort();
  } catch {
    /* ignore */
  }
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(Object.assign(new Error("Không đọc được ảnh."), { code: "IMAGE_LOAD" }));
    };
    img.src = url;
  });
}

/** Cap long edge so 2x output ≤ LOCAL_MAX_OUTPUT_EDGE. Preserve aspect, no crop. */
function prepareCanvasForUpscale(img) {
  const scale = 2;
  const maxIn = Math.floor(LOCAL_MAX_OUTPUT_EDGE / scale);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) {
    const err = new Error("Ảnh không có kích thước hợp lệ.");
    err.code = "BAD_DIMENSIONS";
    throw err;
  }

  const long = Math.max(w, h);
  if (long > maxIn) {
    const r = maxIn / long;
    w = Math.max(1, Math.round(w * r));
    h = Math.max(1, Math.round(h * r));
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    const err = new Error(ENHANCE_UI.oom);
    err.code = "NO_CANVAS";
    throw err;
  }
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

function dataUrlToBlob(dataUrl) {
  const parts = String(dataUrl).split(",");
  const header = parts[0] || "";
  const b64 = parts[1] || "";
  const mimeMatch = /data:([^;]+)/.exec(header);
  const mime = mimeMatch?.[1] || "image/png";
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function isOomError(e) {
  const msg = String(e?.message || e || "").toLowerCase();
  return (
    e?.code === "OOM" ||
    /out of memory|oom|allocation failed|failed to allocate|webgl|gpu|too large|memory/i.test(
      msg,
    )
  );
}

/**
 * Enhance a **copy** of the post-capture image on-device.
 * Does not mutate originalFile / originalMediaBlob.
 * @returns {{ file: File, model: string, provider: 'local' }}
 */
export async function enhanceImageLocal(file, { signal, onProgress } = {}) {
  const check = assertEnhanceableFile(file);
  if (!check.ok) {
    const err = new Error(check.message);
    err.code = "CLIENT_VALIDATION";
    throw err;
  }

  if (signal?.aborted) {
    const err = new Error("Đã hủy");
    err.code = "ABORTED";
    throw err;
  }

  // First load needs to fetch same-origin model static files (or SW cache).
  const online = typeof navigator !== "undefined" ? navigator.onLine !== false : true;
  if (!online) {
    const cached = await isLocalModelLikelyCached();
    if (!cached && !modelReady) {
      const err = new Error(ENHANCE_UI.needNetworkOnce);
      err.code = "MODEL_NEEDS_NETWORK";
      throw err;
    }
  }

  onProgress?.({ phase: "loading_model", percent: 0, message: ENHANCE_UI.loadingModel });

  let upscaler;
  try {
    upscaler = await getUpscaler();
  } catch (e) {
    if (!online) {
      const err = new Error(ENHANCE_UI.needNetworkOnce);
      err.code = "MODEL_NEEDS_NETWORK";
      throw err;
    }
    if (isOomError(e)) {
      const err = new Error(ENHANCE_UI.oom);
      err.code = "OOM";
      throw err;
    }
    const err = new Error(e?.message || "Không tải được model AI miễn phí.");
    err.code = e?.code || "MODEL_LOAD_FAILED";
    throw err;
  }

  if (signal?.aborted) {
    const err = new Error("Đã hủy");
    err.code = "ABORTED";
    throw err;
  }

  onProgress?.({ phase: "prepare", percent: 5, message: ENHANCE_UI.progress });

  let img = await loadImageFromBlob(file);
  const canvas = prepareCanvasForUpscale(img);
  img = null;

  onProgress?.({ phase: "running", percent: 8, message: ENHANCE_UI.progress });

  const onAbort = () => {
    try {
      upscaler.abort();
    } catch {
      /* ignore */
    }
  };
  signal?.addEventListener?.("abort", onAbort, { once: true });

  let base64;
  try {
    base64 = await upscaler.upscale(canvas, {
      output: "base64",
      patchSize: LOCAL_PATCH_SIZE,
      padding: LOCAL_PATCH_PADDING,
      awaitNextFrame: true,
      signal,
      progress: (p) => {
        const ratio = typeof p === "number" ? p : 0;
        const percent = Math.min(99, Math.round(8 + ratio * 90));
        onProgress?.({
          phase: "running",
          percent,
          message: `${ENHANCE_UI.progress} ${percent}%`,
        });
      },
    });
  } catch (e) {
    if (signal?.aborted || e?.name === "AbortError" || /abort/i.test(String(e?.message))) {
      const err = new Error("Đã hủy");
      err.code = "ABORTED";
      throw err;
    }
    if (isOomError(e)) {
      const err = new Error(ENHANCE_UI.oom);
      err.code = "OOM";
      throw err;
    }
    const err = new Error(e?.message || ENHANCE_UI.failBody);
    err.code = e?.code || "LOCAL_FAILED";
    throw err;
  } finally {
    signal?.removeEventListener?.("abort", onAbort);
    try {
      canvas.width = 0;
      canvas.height = 0;
    } catch {
      /* ignore */
    }
  }

  if (!base64 || typeof base64 !== "string") {
    const err = new Error("AI không trả kết quả.");
    err.code = "PROVIDER_EMPTY";
    throw err;
  }

  // data URL → Blob immediately; never keep base64 in app state
  let blob;
  try {
    blob = dataUrlToBlob(base64);
  } finally {
    base64 = null;
  }

  let outBlob = blob;
  if (!blob.type || blob.type === "image/png" || blob.type.includes("png")) {
    try {
      outBlob = await canvasToJpegBlob(blob);
    } catch {
      outBlob = blob;
    }
  }

  const mime = outBlob.type || "image/jpeg";
  const ext = mime.includes("png") ? "png" : "jpg";
  const out = new File([outBlob], `enhance_local_${Date.now()}.${ext}`, {
    type: mime,
  });

  onProgress?.({ phase: "done", percent: 100, message: "Hoàn tất" });
  return { file: out, model: LOCAL_MODEL_ID, provider: "local" };
}

async function canvasToJpegBlob(blob) {
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement("canvas");
    c.width = bmp.width;
    c.height = bmp.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp);
    bmp.close?.();
    const jpeg = await new Promise((resolve, reject) => {
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.92,
      );
    });
    c.width = 0;
    c.height = 0;
    return jpeg;
  }
  return blob;
}
