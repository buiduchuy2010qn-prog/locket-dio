/**
 * Dedicated Web Worker for on-device ESRGAN Slim 2x.
 * Runs UpscalerJS + TF.js off the main thread so a 60s watchdog can terminate() us.
 *
 * Protocol (main ↔ worker):
 *   → { type: 'enhance', jobId, bitmap, modelPath, patchSize, padding }
 *   → { type: 'cancel', jobId }
 *   ← { type: 'heartbeat', jobId, t }
 *   ← { type: 'progress', jobId, phase, percent, message }
 *   ← { type: 'done', jobId, buffer, mime }  (transferable ArrayBuffer)
 *   ← { type: 'error', jobId, code, message }
 */
/* eslint-disable no-restricted-globals */

let upscaler = null;
let activeJobId = null;
let cancelled = false;
let heartbeatTimer = null;

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat(jobId) {
  clearHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (activeJobId === jobId && !cancelled) {
      self.postMessage({ type: "heartbeat", jobId, t: Date.now() });
    }
  }, 2000);
  self.postMessage({ type: "heartbeat", jobId, t: Date.now() });
}

function postProgress(jobId, phase, percent, message) {
  if (activeJobId !== jobId || cancelled) return;
  self.postMessage({
    type: "progress",
    jobId,
    phase,
    percent,
    message,
  });
  self.postMessage({ type: "heartbeat", jobId, t: Date.now() });
}

async function ensureTf() {
  const tf = await import("@tensorflow/tfjs");
  try {
    // Prefer WebGL when available in worker (OffscreenCanvas)
    await tf.setBackend("webgl");
    await tf.ready();
  } catch {
    try {
      await tf.setBackend("cpu");
      await tf.ready();
    } catch {
      /* use default */
    }
  }
  return tf;
}

async function getUpscaler(modelPath) {
  if (upscaler) return upscaler;
  await ensureTf();
  const [{ default: Upscaler }, { default: x2 }] = await Promise.all([
    import("upscaler"),
    import("@upscalerjs/esrgan-slim/2x"),
  ]);
  upscaler = new Upscaler({
    model: {
      ...x2,
      path: modelPath,
    },
  });
  return upscaler;
}

function dataUrlToArrayBuffer(dataUrl) {
  const parts = String(dataUrl).split(",");
  const header = parts[0] || "";
  const b64 = parts[1] || "";
  const mimeMatch = /data:([^;]+)/.exec(header);
  const mime = mimeMatch?.[1] || "image/png";
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return { buffer: bytes.buffer, mime, byteLength: len };
}

async function runEnhance(msg) {
  const { jobId, bitmap, modelPath, patchSize = 48, padding = 4 } = msg;
  activeJobId = jobId;
  cancelled = false;
  startHeartbeat(jobId);

  try {
    postProgress(jobId, "loading_model", 2, "Đang tải AI miễn phí…");

    let scaler;
    try {
      scaler = await getUpscaler(modelPath);
    } catch (e) {
      if (cancelled || activeJobId !== jobId) return;
      self.postMessage({
        type: "error",
        jobId,
        code: "MODEL_LOAD_FAILED",
        message: e?.message || "Không tải được model AI miễn phí.",
      });
      return;
    }

    if (cancelled || activeJobId !== jobId) {
      try {
        bitmap?.close?.();
      } catch {
        /* ignore */
      }
      return;
    }

    postProgress(jobId, "running", 8, "Đang làm nét…");

    let base64;
    try {
      base64 = await scaler.upscale(bitmap, {
        output: "base64",
        patchSize,
        padding,
        awaitNextFrame: true,
        progress: (p) => {
          if (cancelled || activeJobId !== jobId) return;
          const ratio = typeof p === "number" ? p : 0;
          const percent = Math.min(99, Math.round(8 + ratio * 90));
          postProgress(jobId, "running", percent, `Đang làm nét… ${percent}%`);
        },
      });
    } catch (e) {
      if (cancelled || activeJobId !== jobId) return;
      const msgText = String(e?.message || e || "");
      if (/abort/i.test(msgText)) {
        self.postMessage({
          type: "error",
          jobId,
          code: "ABORTED",
          message: "Đã hủy",
        });
        return;
      }
      if (/out of memory|oom|allocation|webgl|memory/i.test(msgText)) {
        self.postMessage({
          type: "error",
          jobId,
          code: "OOM",
          message: "Thiết bị không đủ tài nguyên để làm nét ảnh này",
        });
        return;
      }
      self.postMessage({
        type: "error",
        jobId,
        code: "LOCAL_FAILED",
        message: msgText || "Làm nét thất bại",
      });
      return;
    } finally {
      try {
        bitmap?.close?.();
      } catch {
        /* ignore */
      }
    }

    if (cancelled || activeJobId !== jobId) return;

    if (!base64 || typeof base64 !== "string") {
      self.postMessage({
        type: "error",
        jobId,
        code: "PROVIDER_EMPTY",
        message: "AI không trả kết quả.",
      });
      return;
    }

    postProgress(jobId, "encoding", 99, "Đang xuất ảnh…");
    const { buffer, mime } = dataUrlToArrayBuffer(base64);
    base64 = null;

    if (cancelled || activeJobId !== jobId) return;

    self.postMessage(
      {
        type: "done",
        jobId,
        buffer,
        mime: mime || "image/png",
      },
      [buffer],
    );
  } finally {
    clearHeartbeat();
    if (activeJobId === jobId) activeJobId = null;
  }
}

self.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "cancel") {
    if (msg.jobId && activeJobId && msg.jobId !== activeJobId) return;
    cancelled = true;
    try {
      upscaler?.abort();
    } catch {
      /* ignore */
    }
    return;
  }

  if (msg.type === "dispose") {
    cancelled = true;
    clearHeartbeat();
    activeJobId = null;
    try {
      upscaler?.abort();
    } catch {
      /* ignore */
    }
    const inst = upscaler;
    upscaler = null;
    if (inst) {
      Promise.resolve()
        .then(() => inst.dispose?.())
        .catch(() => {});
    }
    return;
  }

  if (msg.type === "enhance") {
    void runEnhance(msg);
  }
};
