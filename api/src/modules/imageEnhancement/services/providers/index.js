const { enhanceWithReplicate } = require("./replicate");

/**
 * Resolve provider from env. No fake local sharpen presented as AI.
 */
async function runEnhancementProvider(opts) {
  const name = String(process.env.IMAGE_ENHANCEMENT_PROVIDER || "replicate")
    .trim()
    .toLowerCase();

  if (name === "none" || name === "off" || name === "disabled") {
    const err = new Error("AI Làm nét chưa được bật trên máy chủ.");
    err.code = "PROVIDER_NOT_CONFIGURED";
    throw err;
  }

  if (name === "replicate") {
    if (!process.env.REPLICATE_API_TOKEN) {
      const err = new Error(
        "Máy chủ chưa cấu hình REPLICATE_API_TOKEN cho AI Làm nét.",
      );
      err.code = "PROVIDER_NOT_CONFIGURED";
      throw err;
    }
    return enhanceWithReplicate(opts);
  }

  const err = new Error(`Provider không hỗ trợ: ${name}`);
  err.code = "PROVIDER_UNKNOWN";
  throw err;
}

function isProviderConfigured() {
  const name = String(process.env.IMAGE_ENHANCEMENT_PROVIDER || "replicate")
    .trim()
    .toLowerCase();
  if (name === "none" || name === "off" || name === "disabled") return false;
  if (name === "replicate") return Boolean(process.env.REPLICATE_API_TOKEN);
  return false;
}

module.exports = { runEnhancementProvider, isProviderConfigured };
