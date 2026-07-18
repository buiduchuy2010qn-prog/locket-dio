const path = require("path");
const fs = require("fs");
const { validateImageBuffer } = require("../services/validateImage");
const jobStore = require("../services/jobStore");
const {
  runEnhancementProvider,
  isProviderConfigured,
  getProviderPublicInfo,
} = require("../services/providers");

const ALLOWED_MODES = new Set(["natural", "portrait", "lowlight"]);

async function createJob(req, res) {
  try {
    if (!req.user?.uid && !req.user?.localId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const uid = String(req.user.uid || req.user.localId);

    if (!isProviderConfigured()) {
      return res.status(503).json({
        success: false,
        code: "PROVIDER_NOT_CONFIGURED",
        message:
          "Làm nét chưa được bật trên máy chủ. Ảnh gốc được giữ nguyên.",
      });
    }

    if (!jobStore.canStart(uid)) {
      return res.status(429).json({
        success: false,
        code: "CONCURRENT_LIMIT",
        message: "Đang có job làm nét khác — chờ xong rồi thử lại.",
      });
    }

    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({
        success: false,
        code: "NO_FILE",
        message: "Thiếu file ảnh.",
      });
    }

    const mode = ALLOWED_MODES.has(req.body?.mode)
      ? req.body.mode
      : "natural";

    const check = await validateImageBuffer(file.buffer, file.mimetype);
    if (!check.ok) {
      return res.status(400).json({
        success: false,
        code: check.code,
        message: check.message,
      });
    }

    const ext =
      check.mime === "image/png"
        ? "png"
        : check.mime === "image/webp"
          ? "webp"
          : "jpg";
    const inputPath = jobStore.writeTempFile(file.buffer, ext);
    // wipe buffer reference as much as possible
    file.buffer = null;

    const job = jobStore.createJob({
      uid,
      mode,
      inputPath,
      mime: check.mime,
    });

    // Async process — do not block request longer than create
    setImmediate(() => processJob(job.id));

    return res.status(202).json({
      success: true,
      jobId: job.id,
      status: job.status,
      mode: job.mode,
    });
  } catch (e) {
    console.error("[image-enhancement] createJob", e?.code || e?.message);
    return res.status(500).json({
      success: false,
      message: "Không tạo được job làm nét.",
    });
  }
}

async function processJob(jobId) {
  const job = jobStore.getJob(jobId);
  if (!job || job.status === "cancelled") return;

  jobStore.updateJob(jobId, { status: "running" });

  try {
    const result = await runEnhancementProvider({
      inputPath: job.inputPath,
      mode: job.mode,
    });

    if (jobStore.getJob(jobId)?.status === "cancelled") {
      jobStore.releaseUserSlot(job.uid);
      return;
    }

    const outExt =
      result.mime?.includes("png")
        ? "png"
        : result.mime?.includes("webp")
          ? "webp"
          : "jpg";
    const outputPath = jobStore.writeTempFile(result.buffer, outExt);

    jobStore.updateJob(jobId, {
      status: "succeeded",
      outputPath,
      mime: result.mime || "image/jpeg",
      model: result.model || null,
      error: null,
      code: null,
    });
    jobStore.releaseUserSlot(job.uid);

    // Remove input ASAP after success
    try {
      fs.unlinkSync(job.inputPath);
    } catch {
      /* ignore */
    }
    jobStore.updateJob(jobId, { inputPath: null });
  } catch (e) {
    const code = e?.code || "PROVIDER_ERROR";
    jobStore.updateJob(jobId, {
      status: "failed",
      error: e?.message || "Làm nét thất bại",
      code,
    });
    jobStore.releaseUserSlot(job.uid);
    try {
      fs.unlinkSync(job.inputPath);
    } catch {
      /* ignore */
    }
  }
}

function getJob(req, res) {
  const uid = String(req.user?.uid || req.user?.localId || "");
  const job = jobStore.getJob(req.params.jobId);
  if (!job || job.uid !== uid) {
    return res.status(404).json({ success: false, message: "Job không tồn tại." });
  }
  return res.json({ success: true, ...jobStore.publicJobView(job) });
}

function getResult(req, res) {
  const uid = String(req.user?.uid || req.user?.localId || "");
  const job = jobStore.getJob(req.params.jobId);
  if (!job || job.uid !== uid) {
    return res.status(404).json({ success: false, message: "Job không tồn tại." });
  }
  if (job.status !== "succeeded" || !job.outputPath) {
    return res.status(409).json({
      success: false,
      message: "Kết quả chưa sẵn sàng.",
      status: job.status,
    });
  }
  try {
    const data = fs.readFileSync(job.outputPath);
    res.setHeader("Content-Type", job.mime || "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(data);
  } catch {
    return res.status(410).json({
      success: false,
      message: "File kết quả đã hết hạn.",
    });
  }
}

function cancelJob(req, res) {
  const uid = String(req.user?.uid || req.user?.localId || "");
  const job = jobStore.getJob(req.params.jobId);
  if (!job || job.uid !== uid) {
    return res.status(404).json({ success: false, message: "Job không tồn tại." });
  }
  if (job.status === "succeeded") {
    return res.status(409).json({
      success: false,
      message: "Job đã xong — không hủy được.",
    });
  }
  jobStore.updateJob(job.id, {
    status: "cancelled",
    error: "Cancelled by user",
    code: "CANCELLED",
  });
  jobStore.destroyJob(job.id);
  return res.json({ success: true, status: "cancelled" });
}

function providerStatus(req, res) {
  const info = getProviderPublicInfo();
  return res.json({
    success: true,
    configured: isProviderConfigured(),
    provider: info.provider,
    isAi: info.isAi,
    label: info.label,
    costHint: info.costHint,
    latencyHint: info.latencyHint,
    thirdParty: info.thirdParty,
    model: info.model,
  });
}

module.exports = {
  createJob,
  getJob,
  getResult,
  cancelJob,
  providerStatus,
};
