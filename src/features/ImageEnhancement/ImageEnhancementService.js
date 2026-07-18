/**
 * Client API for image enhancement (free sharp by default; optional Replicate).
 * Lazy-imported only when user taps the button — no model in main bundle.
 */
import { instanceMain } from "@/libs";
import { getToken } from "@/utils";
import { assertEnhanceableFile } from "./validateClient";

const BASE = "/api/image-enhancement";

export { assertEnhanceableFile };

function authHeaders() {
  const { idToken } = getToken() || {};
  if (!idToken) return {};
  return { Authorization: `Bearer ${idToken}` };
}

/**
 * Create job — multipart. Returns { jobId, status } or throws.
 */
export async function createEnhancementJob(file, mode, { signal } = {}) {
  const check = assertEnhanceableFile(file);
  if (!check.ok) {
    const err = new Error(check.message);
    err.code = "CLIENT_VALIDATION";
    throw err;
  }

  const form = new FormData();
  form.append("image", file, file.name || "photo.jpg");
  form.append("mode", mode || "natural");

  const res = await instanceMain.post(`${BASE}/jobs`, form, {
    headers: {
      ...authHeaders(),
      // Override instanceMain default application/json so boundary is set
      "Content-Type": undefined,
    },
    signal,
    timeout: 120000,
    // transformRequest identity keeps FormData intact
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
    const err = new Error(data?.message || "Không tạo được job làm nét.");
    err.code = data?.code || "CREATE_FAILED";
    err.details = data;
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

/**
 * Download result as Blob (binary), never base64 in app state.
 */
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

/**
 * Poll job with backoff until done/failed/cancelled. Not tight-loop.
 */
export async function waitForEnhancementJob(
  jobId,
  { signal, onProgress, maxMs = 90000 } = {},
) {
  const start = Date.now();
  let delay = 1200;
  while (Date.now() - start < maxMs) {
    if (signal?.aborted) {
      const err = new Error("Đã hủy");
      err.code = "ABORTED";
      throw err;
    }
    const job = await getEnhancementJob(jobId, { signal });
    onProgress?.(job);
    if (job.status === "succeeded") return job;
    if (job.status === "failed" || job.status === "cancelled") {
      const err = new Error(job.error || "Làm nét thất bại");
      err.code = job.code || "JOB_FAILED";
      err.job = job;
      throw err;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(4000, Math.round(delay * 1.35));
  }
  const err = new Error("Làm nét quá lâu — thử lại sau.");
  err.code = "TIMEOUT";
  throw err;
}

/**
 * Full pipeline: create → wait → download File.
 */
export async function enhanceImageFile(file, mode, { signal, onProgress } = {}) {
  const created = await createEnhancementJob(file, mode, { signal });
  onProgress?.({ phase: "queued", jobId: created.jobId, ...created });

  const job = await waitForEnhancementJob(created.jobId, {
    signal,
    onProgress: (j) => onProgress?.({ phase: "running", ...j }),
  });

  const blob = await fetchEnhancementResultBlob(created.jobId, { signal });
  const mime = blob.type || "image/jpeg";
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const out = new File([blob], `enhance_${Date.now()}.${ext}`, { type: mime });
  onProgress?.({ phase: "done", jobId: created.jobId, file: out });
  return { file: out, job, jobId: created.jobId };
}
