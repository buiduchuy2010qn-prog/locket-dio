const { enhanceWithReplicate } = require("./replicate");
const { enhanceWithFreeLocal } = require("./freeLocal");

/**
 * Resolve provider from env.
 * Default: free (sharp on Railway — no credit, no third-party AI).
 * Optional: replicate (needs REPLICATE_API_TOKEN).
 */
function getProviderName() {
  return String(process.env.IMAGE_ENHANCEMENT_PROVIDER || "free")
    .trim()
    .toLowerCase();
}

function isFreeProvider(name) {
  return name === "free" || name === "local" || name === "sharp" || name === "free-local";
}

async function runEnhancementProvider(opts) {
  const name = getProviderName();

  if (name === "none" || name === "off" || name === "disabled") {
    const err = new Error("Làm nét chưa được bật trên máy chủ.");
    err.code = "PROVIDER_NOT_CONFIGURED";
    throw err;
  }

  if (isFreeProvider(name)) {
    return enhanceWithFreeLocal(opts);
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
  const name = getProviderName();
  if (name === "none" || name === "off" || name === "disabled") return false;
  if (isFreeProvider(name)) return true;
  if (name === "replicate") return Boolean(process.env.REPLICATE_API_TOKEN);
  return false;
}

function getProviderPublicInfo() {
  const name = getProviderName();
  if (isFreeProvider(name)) {
    return {
      provider: "free",
      label: "Free (server)",
      isAi: false,
      costHint: "Miễn phí — xử lý trên server Huy Locket",
      latencyHint: "thường 1–5 giây",
      thirdParty: "Không gửi ảnh ra bên thứ ba",
      model: "sharp (làm nét cổ điển, không AI)",
    };
  }
  if (name === "replicate") {
    return {
      provider: "replicate",
      label: "Replicate AI",
      isAi: true,
      costHint: "Tốn credit Replicate",
      latencyHint: "thường 5–30 giây",
      thirdParty: "Ảnh được gửi tạm tới Replicate",
      model: process.env.REPLICATE_MODEL || "nightmareai/real-esrgan",
    };
  }
  return {
    provider: name,
    label: name,
    isAi: false,
    costHint: "—",
    latencyHint: "—",
    thirdParty: "—",
    model: "—",
  };
}

module.exports = {
  runEnhancementProvider,
  isProviderConfigured,
  getProviderPublicInfo,
  getProviderName,
};
