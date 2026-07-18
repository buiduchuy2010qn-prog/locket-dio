/**
 * Cloud enhancement client (Replicate via Railway API).
 * Local path lives in localEnhance.js — never imported from boot bundle here.
 * Lazy-imported only when user chooses Cloud or starts enhance.
 */
import { instanceMain } from "@/libs";
import { getToken } from "@/utils";
import { assertEnhanceableFile } from "./validateClient";
import { ENHANCE_DEADLINE_MS, ENHANCE_UI } from "./constants";

const BASE = "/api/image-enhancement";

export { assertEnhanceableFile };

function authHeaders() {
  const { idToken } = getToken() || {};
  if (!idToken) return {};
  return { Authorization: `Bearer ${idToken}` };
}

/**
 * Map raw provider/API errors → stable codes + Vietnamese (no billing URLs).
 */
export function normalizeEnhanceError(e) {
  const raw =
    e?.response?.data?.message ||
    e?.response?.data?.error ||
    e?.details?.message ||
    e?.message ||
    "";
  const code =
    e?.code ||
    e?.response?.data?.code ||
    e?.details?.code ||
    e?.job?.code ||
    "";
  const text = String(raw);

  if (
    code === "INSUFFICIENT_CREDIT" ||
    /insufficient credit|payment required|402|billing|out of credit|not enough credit/i.test(
      text,
    )
  ) {
    const err = new Error(ENHANCE_UI.creditMessage);
    err.code = "INSUFFICIENT_CREDIT";
    err.userMessage = ENHANCE_UI.creditMessage;
    return err;
  }

  if (code === "PROVIDER_NOT_CONFIGURED") {
    const err = new Error(
      e?.response?.data?.message ||
        "Cloud chưa được cấu hình trên máy chủ.",
    );
    err.code = "PROVIDER_NOT_CONFIGURED";
    return err;
  }

  if (code === "ABORTED" || e?.name === "CanceledError" || e?.name === "AbortError") {
    const err = new Error("Đã hủy");
    err.code = "ABORTED";
    return err;
  }

  if (
    code === "OOM" ||
    code === "MODEL_NEEDS_NETWORK" ||
    code === "TIMED_OUT" ||
    code === "TIMEOUT"
  ) {
    if (code === "TIMEOUT" || code === "TIMED_OUT") {
      const err = new Error(ENHANCE_UI.timedOut);
      err.code = "TIMED_OUT";
      return err;
    }
    return e;
  }

  // Strip English billing noise from generic failures
  if (/insufficient credit|billing\.replicate/i.test(text)) {
    const err = new Error(ENHANCE_UI.creditMessage);
    err.code = "INSUFFICIENT_CREDIT";
    err.userMessage = ENHANCE_UI.creditMessage;
    return err;
  }

  const err = new Error(
    text && !/https?:\/\//i.test(text)
      ? text
      : "AI Cloud thất bại — ảnh gốc được giữ nguyên.",
  );
  err.code = code || "CLOUD_FAILED";
  return err;
}

/** Public status: local always on; cloud when token configured. */
export async function fetchEnhancementStatus({ signal } = {}) {
  try {
    const res = await instanceMain.get(`${BASE}/status`, {
      headers: authHeaders(),
      signal,
      timeout: 15000,
    });
    const d = res?.data || {};
    const cloudAvailable = Boolean(
      d.cloudAvailable ??
        d.replicateConfigured ??
        (d.provider === "replicate" && d.configured),
    );
    return {
      success: true,
      ...d,
      cloudAvailable,
      localAvailable: d.localAvailable !== false,
    };
  } catch {
    // Status may 401 if token missing — still allow local
    return {
      success: false,
      cloudAvailable: false,
      localAvailable: true,
    };
  }
}

export async function createEnhancementJob(file, mode, { signal, provider } = {}) {
  const check = assertEnhanceableFile(file);
  if (!check.ok) {
    const err = new Error(check.message);
    err.code = "CLIENT_VALIDATION";
    throw err;
  }

  const form = new FormData();
  form.append("image", file, file.name || "photo.jpg");
  form.append("mode", mode || "natural");
  // Force Replicate path when user chose Cloud
  form.append("provider", provider || "replicate");

  const res = await instanceMain.post(`${BASE}/jobs`, form, {
    headers: {
      ...authHeaders(),
      "Content-Type": undefined,
    },
    signal,
    timeout: ENHANCE_DEADLINE_MS,
    transformRequest: [
      (data, headers) => {
        if (typeof FormData !== "undefined" && data instanceof FormData) {
          if (headers && typeof headers.delete === "function") {
            headers.delete("Content-Type");
          } else if (headers) {
            delete headers["Content-Type"];
            delete headers["content-type"];
          }
        }
        return data;
      },
    ],
  });

  const data = res?.data;
  if (!data?.jobId) {
    const err = normalizeEnhanceError({
      message: data?.message || "Không tạo được job AI Cloud.",
      code: data?.code || "CREATE_FAILED",
      details: data,
    });
    throw err;
  }
  return data;
}

export async function getEnhancementJob(jobId, { signal } = {}) {
  const res = await instanceMain.get(`${BASE}/jobs/${encodeURIComponent(jobId)}`, {
    headers: authHeaders(),
    signal,
    timeout: 60000,
  });
  return res?.data;
}

export async function cancelEnhancementJob(jobId) {
  try {
    await instanceMain.delete(`${BASE}/jobs/${encodeURIComponent(jobId)}`, {
      headers: authHeaders(),
      timeout: 30000,
    });
  } catch {
    /* best effort */
  }
}

export async function fetchEnhancementResultBlob(jobId, { signal } = {}) {
  const res = await instanceMain.get(
    `${BASE}/jobs/${encodeURIComponent(jobId)}/result`,
    {
      headers: authHeaders(),
      responseType: "blob",
      signal,
      timeout: 120000,
    },
  );
  return res.data;
}

export async function waitForEnhancementJob(
  jobId,
  { signal, onProgress, maxMs = ENHANCE_DEADLINE_MS, deadlineAt } = {},
) {
  const start = Date.now();
  const hardDeadline = deadlineAt || start + maxMs;
  let delay = 1000;
  while (Date.now() < hardDeadline) {
    if (signal?.aborted) {
      const err = new Error("Đã hủy");
      err.code = "ABORTED";
      throw err;
    }
    const job = await getEnhancementJob(jobId, { signal });
    const remainingMs = Math.max(0, hardDeadline - Date.now());
    onProgress?.(job);
    onProgress?.({ ...job, phase: "running", remainingMs });
    if (job.status === "succeeded") return job;
    if (job.status === "failed" || job.status === "cancelled") {
      throw normalizeEnhanceError({
        message: job.error || "AI Cloud thất bại",
        code: job.code || "JOB_FAILED",
        job,
      });
    }
    const wait = Math.min(delay, Math.max(0, hardDeadline - Date.now()));
    if (wait <= 0) break;
    await new Promise((r) => setTimeout(r, wait));
    delay = Math.min(2500, Math.round(delay * 1.25));
  }
  // Deadline — cancel server job; do not keep polling/billing
  try {
    await cancelEnhancementJob(jobId);
  } catch {
    /* best effort */
  }
  const err = new Error(ENHANCE_UI.timedOut);
  err.code = "TIMED_OUT";
  throw err;
}

/** Full cloud pipeline: create → wait → download File. Hard 60s client deadline. */
export async function enhanceImageCloud(file, mode, { signal, onProgress } = {}) {
  const deadlineAt = Date.now() + ENHANCE_DEADLINE_MS;
  let jobId = null;

  try {
    const created = await createEnhancementJob(file, mode, {
      signal,
      provider: "replicate",
    });
    jobId = created.jobId;
    onProgress?.({
      phase: "queued",
      jobId: created.jobId,
      remainingMs: Math.max(0, deadlineAt - Date.now()),
      ...created,
    });

    if (Date.now() >= deadlineAt) {
      await cancelEnhancementJob(jobId);
      const err = new Error(ENHANCE_UI.timedOut);
      err.code = "TIMED_OUT";
      throw err;
    }

    const job = await waitForEnhancementJob(created.jobId, {
      signal,
      deadlineAt,
      onProgress: (j) =>
        onProgress?.({
          phase: "running",
          remainingMs: Math.max(0, deadlineAt - Date.now()),
          ...j,
        }),
    });

    if (Date.now() >= deadlineAt) {
      const err = new Error(ENHANCE_UI.timedOut);
      err.code = "TIMED_OUT";
      throw err;
    }

    const blob = await fetchEnhancementResultBlob(created.jobId, { signal });
    const mime = blob.type || "image/jpeg";
    const ext = mime.includes("png")
      ? "png"
      : mime.includes("webp")
        ? "webp"
        : "jpg";
    const out = new File([blob], `enhance_cloud_${Date.now()}.${ext}`, {
      type: mime,
    });
    onProgress?.({ phase: "done", jobId: created.jobId, file: out, remainingMs: 0 });
    return {
      file: out,
      job,
      jobId: created.jobId,
      provider: "cloud",
      model: job?.model || "replicate",
    };
  } catch (e) {
    if (e?.code === "TIMED_OUT" && jobId) {
      try {
        await cancelEnhancementJob(jobId);
      } catch {
        /* ignore */
      }
    }
    throw e;
  }
}

/** @deprecated use enhanceImageCloud — kept name for any old imports */
export async function enhanceImageFile(file, mode, opts = {}) {
  return enhanceImageCloud(file, mode, opts);
}
