const { enhanceWithReplicate } = require("./replicate");
const { enhanceWithFreeLocal } = require("./freeLocal");

/**
 * Dual-path backend:
 * - client "local" = on-device (never hits this module)
 * - client "cloud"/provider=replicate → Replicate (needs token)
 * - optional server "free"/sharp for legacy env
 */
function getProviderName() {
  return String(process.env.IMAGE_ENHANCEMENT_PROVIDER || "free")
    .trim()
    .toLowerCase();
}

function isFreeProvider(name) {
  return (
    name === "free" ||
    name === "local" ||
    name === "sharp" ||
    name === "free-local"
  );
}

function isReplicateConfigured() {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

/**
 * @param {{ inputPath: string, mode?: string, provider?: string, signal?: AbortSignal }} opts
 */
async function runEnhancementProvider(opts) {
  const requested = String(opts.provider || getProviderName())
    .trim()
    .toLowerCase();

  if (
    requested === "none" ||
    requested === "off" ||
    requested === "disabled"
  ) {
    const err = new Error("Làm nét cloud chưa được bật trên máy chủ.");
    err.code = "PROVIDER_NOT_CONFIGURED";
    throw err;
  }

  // Cloud path (client sends provider=replicate)
  if (
    requested === "replicate" ||
    requested === "cloud" ||
    requested === "ai"
  ) {
    if (!isReplicateConfigured()) {
      const err = new Error(
        "Máy chủ chưa cấu hình REPLICATE_API_TOKEN cho AI Cloud.",
      );
      err.code = "PROVIDER_NOT_CONFIGURED";
      throw err;
    }
    return enhanceWithReplicate(opts);
  }

  if (isFreeProvider(requested)) {
    return enhanceWithFreeLocal(opts);
  }

  const err = new Error(`Provider không hỗ trợ: ${requested}`);
  err.code = "PROVIDER_UNKNOWN";
  throw err;
}

function isProviderConfigured(requested) {
  const name = String(requested || getProviderName())
    .trim()
    .toLowerCase();
  if (name === "none" || name === "off" || name === "disabled") return false;
  if (name === "replicate" || name === "cloud" || name === "ai") {
    return isReplicateConfigured();
  }
  if (isFreeProvider(name)) return true;
  return false;
}

/** Cloud available when Replicate token present (independent of default free). */
function isCloudConfigured() {
  return isReplicateConfigured();
}

function getProviderPublicInfo() {
  return {
    provider: getProviderName(),
    localAvailable: true,
    cloudAvailable: isCloudConfigured(),
    replicateConfigured: isCloudConfigured(),
    label: isCloudConfigured() ? "local+cloud" : "local-only",
    isAi: true,
    costHint: "Local free; Cloud tốn credit Replicate",
    latencyHint: "local 5–60s · cloud 5–30s",
    thirdParty: "Local: không gửi ảnh · Cloud: Replicate",
    model: "@upscalerjs/esrgan-slim/2x | nightmareai/real-esrgan",
  };
}

module.exports = {
  runEnhancementProvider,
  isProviderConfigured,
  isCloudConfigured,
  getProviderPublicInfo,
  getProviderName,
};
