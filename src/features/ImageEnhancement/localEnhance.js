/**
 * On-device ESRGAN Slim 2x — main-thread orchestrator.
 * Inference runs in a Dedicated Worker; main holds a 60s hard deadline and
 * can worker.terminate() so AI cannot keep running after timeout/cancel.
 *
 * Does not touch camera/music. Free path never uploads the image.
 */
import {
  LOCAL_MODEL_ID,
  LOCAL_MODEL_JSON_PATH,
  LOCAL_QUALITY,
  DEFAULT_LOCAL_QUALITY,
  ENHANCE_DEADLINE_MS,
  ENHANCE_HEARTBEAT_STALE_MS,
  ENHANCE_PROGRESS_THROTTLE_MS,
  ENHANCE_SLOW_HINT_MS,
  ENHANCE_SLOW_HINT_MAX_PERCENT,
  ENHANCE_UI,
} from "./constants";
import { assertEnhanceableFile } from "./validateClient";

/** @type {Worker | null} */
let sharedWorker = null;
/** Active job generation — ignore late messages */
let activeJobId = null;
/** @type {'idle'|'running'|'timed_out'|'cancelled'|'failed'|'succeeded'} */
let jobStatus = "idle";

export function isLocalModelReady() {
  return false; // model lives in worker; not tracked on main
}

export function getLocalModelJsonUrl() {
  const path = LOCAL_MODEL_JSON_PATH || "/ai-models/esrgan-slim-2x/v1/model.json";
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(path, window.location.origin).href;
  }
  return path;
}

export async function isLocalModelLikelyCached() {
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

function newJobId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function killWorker() {
  if (!sharedWorker) return;
  try {
    sharedWorker.postMessage({ type: "cancel", jobId: activeJobId });
  } catch {
    /* ignore */
  }
  try {
    sharedWorker.terminate();
  } catch {
    /* ignore */
  }
  sharedWorker = null;
}

/** Soft abort (if worker still alive) + hard terminate. */
export function abortLocalEnhancer() {
  if (jobStatus === "running") {
    jobStatus = "cancelled";
  }
  killWorker();
}

/** Dispose everything when leaving editor. */
export async function disposeLocalEnhancer() {
  jobStatus = "idle";
  activeJobId = null;
  killWorker();
}

/**
 * Resize image for weak phones. Returns ImageBitmap (caller may transfer).
 * @param {Blob|File} file
 * @param {number} maxInputEdge
 */
async function prepareImageBitmap(file, maxInputEdge) {
  let srcBmp;
  try {
    srcBmp = await createImageBitmap(file);
  } catch {
    const err = new Error("Không đọc được ảnh.");
    err.code = "IMAGE_LOAD";
    throw err;
  }

  let w = srcBmp.width;
  let h = srcBmp.height;
  if (!w || !h) {
    try {
      srcBmp.close();
    } catch {
      /* ignore */
    }
    const err = new Error("Ảnh không có kích thước hợp lệ.");
    err.code = "BAD_DIMENSIONS";
    throw err;
  }

  const long = Math.max(w, h);
  if (long > maxInputEdge) {
    const r = maxInputEdge / long;
    w = Math.max(1, Math.round(w * r));
    h = Math.max(1, Math.round(h * r));
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    try {
      srcBmp.close();
    } catch {
      /* ignore */
    }
    const err = new Error(ENHANCE_UI.oom);
    err.code = "NO_CANVAS";
    throw err;
  }
  ctx.drawImage(srcBmp, 0, 0, w, h);
  try {
    srcBmp.close();
  } catch {
    /* ignore */
  }

  const outBmp = await createImageBitmap(canvas);
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    /* ignore */
  }
  return { bitmap: outBmp, width: w, height: h };
}

function createWorker() {
  // Vite: module worker with separate chunk (TF/Upscaler isolated)
  return new Worker(new URL("./enhance.worker.js", import.meta.url), {
    type: "module",
    name: "huy-locket-enhance",
  });
}

/**
 * Enhance a copy of the post-capture image on-device (worker + 60s hard deadline).
 * @param {File|Blob} file
 * @param {{ signal?: AbortSignal, onProgress?: Function, quality?: 'default'|'superfast', jobId?: string }} opts
 */
export async function enhanceImageLocal(file, opts = {}) {
  const {
    signal,
    onProgress,
    quality: qualityKey = DEFAULT_LOCAL_QUALITY,
  } = opts;

  const check = assertEnhanceableFile(file);
  if (!check.ok) {
    const err = new Error(check.message);
    err.code = "CLIENT_VALIDATION";
    throw err;
  }

  if (typeof Worker === "undefined") {
    const err = new Error(
      "Trình duyệt không hỗ trợ Web Worker — không chạy AI an toàn được.",
    );
    err.code = "NO_WORKER";
    throw err;
  }

  if (signal?.aborted) {
    const err = new Error("Đã hủy");
    err.code = "ABORTED";
    throw err;
  }

  // Only one local job at a time — kill any previous worker
  killWorker();

  const quality =
    LOCAL_QUALITY[qualityKey] || LOCAL_QUALITY[DEFAULT_LOCAL_QUALITY];
  const jobId = opts.jobId || newJobId();
  activeJobId = jobId;
  jobStatus = "running";

  const online =
    typeof navigator !== "undefined" ? navigator.onLine !== false : true;
  if (!online) {
    const cached = await isLocalModelLikelyCached();
    if (!cached) {
      jobStatus = "failed";
      activeJobId = null;
      const err = new Error(ENHANCE_UI.needNetworkOnce);
      err.code = "MODEL_NEEDS_NETWORK";
      throw err;
    }
  }

  onProgress?.({
    phase: "prepare",
    percent: 1,
    message: ENHANCE_UI.progress,
    jobId,
    remainingMs: ENHANCE_DEADLINE_MS,
  });

  let prepared;
  try {
    prepared = await prepareImageBitmap(file, quality.maxInputEdge);
  } catch (e) {
    jobStatus = "failed";
    if (activeJobId === jobId) activeJobId = null;
    throw e;
  }

  if (signal?.aborted || activeJobId !== jobId) {
    try {
      prepared.bitmap.close();
    } catch {
      /* ignore */
    }
    jobStatus = "cancelled";
    activeJobId = null;
    const err = new Error("Đã hủy");
    err.code = "ABORTED";
    throw err;
  }

  const modelPath = getLocalModelJsonUrl();
  const worker = createWorker();
  sharedWorker = worker;

  const startedAt = Date.now();
  let lastHeartbeat = Date.now();
  let lastProgressAt = 0;
  let slowHintSent = false;

  return new Promise((resolve, reject) => {
    let settled = false;
    let deadlineTimer;
    let heartbeatWatch;
    let countdownTick;

    const onAbort = () => {
      if (settled || activeJobId !== jobId) return;
      jobStatus = "cancelled";
      hardKillWorker();
      finish(() => {
        const err = new Error("Đã hủy");
        err.code = "ABORTED";
        reject(err);
      });
    };

    function hardKillWorker() {
      try {
        worker.postMessage({ type: "cancel", jobId });
      } catch {
        /* ignore */
      }
      try {
        worker.terminate();
      } catch {
        /* ignore */
      }
      if (sharedWorker === worker) sharedWorker = null;
      activeJobId = null;
    }

    function cleanupTimers() {
      clearTimeout(deadlineTimer);
      clearInterval(heartbeatWatch);
      clearInterval(countdownTick);
      try {
        signal?.removeEventListener?.("abort", onAbort);
      } catch {
        /* ignore */
      }
    }

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      cleanupTimers();
      fn();
    };

    deadlineTimer = setTimeout(() => {
      if (settled || activeJobId !== jobId) return;
      jobStatus = "timed_out";
      // Soft cancel + hard terminate (Promise.race alone is NOT enough)
      hardKillWorker();
      finish(() => {
        const err = new Error(ENHANCE_UI.timedOut);
        err.code = "TIMED_OUT";
        reject(err);
      });
    }, ENHANCE_DEADLINE_MS);

    heartbeatWatch = setInterval(() => {
      if (settled || activeJobId !== jobId) return;
      if (Date.now() - lastHeartbeat > ENHANCE_HEARTBEAT_STALE_MS) {
        jobStatus = "timed_out";
        hardKillWorker();
        finish(() => {
          const err = new Error(ENHANCE_UI.timedOut);
          err.code = "TIMED_OUT";
          reject(err);
        });
      }
    }, 1000);

    countdownTick = setInterval(() => {
      if (settled || activeJobId !== jobId) return;
      const elapsed = Date.now() - startedAt;
      onProgress?.({
        phase: "tick",
        jobId,
        remainingMs: Math.max(0, ENHANCE_DEADLINE_MS - elapsed),
        elapsedMs: elapsed,
      });
    }, 250);

    signal?.addEventListener?.("abort", onAbort, { once: true });

    worker.onerror = (ev) => {
      if (settled || activeJobId !== jobId) return;
      jobStatus = "failed";
      hardKillWorker();
      finish(() => {
        const err = new Error(ev?.message || "Worker AI lỗi.");
        err.code = "WORKER_ERROR";
        reject(err);
      });
    };

    worker.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || msg.jobId !== jobId) return;

      // After timeout/cancel, ignore everything (including late success)
      if (
        settled ||
        jobStatus === "timed_out" ||
        jobStatus === "cancelled" ||
        activeJobId !== jobId
      ) {
        return;
      }

      if (msg.type === "heartbeat") {
        lastHeartbeat = Date.now();
        return;
      }

      if (msg.type === "progress") {
        lastHeartbeat = Date.now();
        const now = Date.now();
        if (now - lastProgressAt < ENHANCE_PROGRESS_THROTTLE_MS) return;
        lastProgressAt = now;
        const elapsed = now - startedAt;
        const remainingMs = Math.max(0, ENHANCE_DEADLINE_MS - elapsed);
        const percent =
          typeof msg.percent === "number" ? msg.percent : undefined;

        if (
          !slowHintSent &&
          elapsed >= ENHANCE_SLOW_HINT_MS &&
          (percent == null || percent < ENHANCE_SLOW_HINT_MAX_PERCENT)
        ) {
          slowHintSent = true;
          onProgress?.({
            phase: "slow_hint",
            jobId,
            percent,
            message: ENHANCE_UI.slowHint,
            remainingMs,
            elapsedMs: elapsed,
          });
        }

        onProgress?.({
          phase: msg.phase || "running",
          jobId,
          percent,
          message: msg.message,
          remainingMs,
          elapsedMs: elapsed,
        });
        return;
      }

      if (msg.type === "error") {
        jobStatus = msg.code === "ABORTED" ? "cancelled" : "failed";
        hardKillWorker();
        finish(() => {
          const err = new Error(msg.message || "Làm nét thất bại");
          err.code = msg.code || "LOCAL_FAILED";
          reject(err);
        });
        return;
      }

      if (msg.type === "done") {
        if (Date.now() - startedAt > ENHANCE_DEADLINE_MS) {
          jobStatus = "timed_out";
          hardKillWorker();
          finish(() => {
            const err = new Error(ENHANCE_UI.timedOut);
            err.code = "TIMED_OUT";
            reject(err);
          });
          return;
        }

        const mime = msg.mime || "image/png";
        const blob = new Blob([msg.buffer], { type: mime });
        const ext = mime.includes("png")
          ? "png"
          : mime.includes("webp")
            ? "webp"
            : "jpg";
        const out = new File([blob], `enhance_local_${Date.now()}.${ext}`, {
          type: mime,
        });

        jobStatus = "succeeded";
        hardKillWorker();
        finish(() => {
          onProgress?.({
            phase: "done",
            percent: 100,
            message: "Hoàn tất",
            jobId,
            remainingMs: 0,
          });
          resolve({
            file: out,
            model: LOCAL_MODEL_ID,
            provider: "local",
            jobId,
            quality: quality.id,
          });
        });
      }
    };

    try {
      worker.postMessage(
        {
          type: "enhance",
          jobId,
          bitmap: prepared.bitmap,
          modelPath,
          patchSize: quality.patchSize,
          padding: quality.padding,
        },
        [prepared.bitmap],
      );
    } catch (e) {
      try {
        prepared.bitmap.close();
      } catch {
        /* ignore */
      }
      jobStatus = "failed";
      hardKillWorker();
      finish(() => {
        const err = new Error(e?.message || "Không gửi được job AI.");
        err.code = "POST_FAILED";
        reject(err);
      });
    }
  });
}
