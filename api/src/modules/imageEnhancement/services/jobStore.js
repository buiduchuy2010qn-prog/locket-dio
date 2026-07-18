const fs = require("fs");
const path = require("path");
const os = require("os");
const { randomUUID } = require("crypto");

const jobs = new Map(); // id -> job
const userActive = new Map(); // uid -> count

const TTL_MS = Number(process.env.IMAGE_ENHANCE_JOB_TTL_MS || 15 * 60 * 1000);
const MAX_CONCURRENT_PER_USER = Number(
  process.env.IMAGE_ENHANCE_MAX_CONCURRENT || 1,
);

const TMP_ROOT = path.join(os.tmpdir(), "huy-locket-enhance");

function ensureTmp() {
  try {
    fs.mkdirSync(TMP_ROOT, { recursive: true });
  } catch {
    /* ignore */
  }
}

function bumpUser(uid, delta) {
  const n = (userActive.get(uid) || 0) + delta;
  if (n <= 0) userActive.delete(uid);
  else userActive.set(uid, n);
}

function canStart(uid) {
  return (userActive.get(uid) || 0) < MAX_CONCURRENT_PER_USER;
}

function createJob({ uid, mode, inputPath, mime, provider }) {
  ensureTmp();
  const id = randomUUID();
  const job = {
    id,
    uid,
    mode: mode || "natural",
    provider: provider || null,
    status: "queued", // queued | running | succeeded | failed | cancelled
    mime,
    inputPath,
    outputPath: null,
    error: null,
    code: null,
    model: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: Date.now() + TTL_MS,
  };
  jobs.set(id, job);
  bumpUser(uid, 1);
  return job;
}

function getJob(id) {
  const job = jobs.get(id);
  if (!job) return null;
  if (Date.now() > job.expiresAt) {
    destroyJob(id);
    return null;
  }
  return job;
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: Date.now() });
  return job;
}

function safeUnlink(p) {
  if (!p) return;
  try {
    fs.unlinkSync(p);
  } catch {
    /* ignore */
  }
}

function destroyJob(id) {
  const job = jobs.get(id);
  if (!job) return;
  safeUnlink(job.inputPath);
  safeUnlink(job.outputPath);
  if (job.status === "queued" || job.status === "running") {
    bumpUser(job.uid, -1);
  }
  jobs.delete(id);
}

function releaseUserSlot(uid) {
  bumpUser(uid, -1);
}

function publicJobView(job) {
  if (!job) return null;
  return {
    jobId: job.id,
    status: job.status,
    mode: job.mode,
    model: job.model,
    error: job.error,
    code: job.code,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function writeTempFile(buffer, ext) {
  ensureTmp();
  const p = path.join(TMP_ROOT, `${randomUUID()}.${ext || "bin"}`);
  fs.writeFileSync(p, buffer);
  return p;
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now > job.expiresAt) destroyJob(id);
  }
}, 60_000).unref?.();

module.exports = {
  createJob,
  getJob,
  updateJob,
  destroyJob,
  releaseUserSlot,
  publicJobView,
  writeTempFile,
  canStart,
  MAX_CONCURRENT_PER_USER,
};
