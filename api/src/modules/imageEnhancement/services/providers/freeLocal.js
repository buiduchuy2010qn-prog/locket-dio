const fs = require("fs");
const sharp = require("sharp");

/**
 * Free on-server enhance via sharp (no third-party AI, no credit).
 * Honest classic processing: mild denoise + unsharp + mode tweaks.
 * Never logs image bytes.
 */
const MODEL_ID = "huy-locket/free-sharp";

function modePipeline(image, mode) {
  // Shared: gentle denoise + sharpen. Modes only tweak strengths.
  if (mode === "portrait") {
    // Keep faces natural — lighter sharpen, slight denoise
    return image
      .median(1)
      .modulate({ brightness: 1.01, saturation: 1.02 })
      .sharpen({ sigma: 0.9, m1: 0.8, m2: 0.35 });
  }
  if (mode === "lowlight") {
    // Lift shadows a bit, more denoise, moderate sharpen
    return image
      .median(2)
      .modulate({ brightness: 1.06, saturation: 0.98 })
      .gamma(1.05)
      .sharpen({ sigma: 1.1, m1: 1.0, m2: 0.4 });
  }
  // natural
  return image
    .median(1)
    .modulate({ brightness: 1.02, saturation: 1.03 })
    .sharpen({ sigma: 1.15, m1: 1.05, m2: 0.45 });
}

/**
 * @param {{ inputPath: string, mode?: string, signal?: AbortSignal }} opts
 * @returns {Promise<{ buffer: Buffer, mime: string, model: string }>}
 */
async function enhanceWithFreeLocal({ inputPath, mode }) {
  if (!inputPath || !fs.existsSync(inputPath)) {
    const err = new Error("Không tìm thấy ảnh đầu vào.");
    err.code = "NO_INPUT";
    throw err;
  }

  let pipeline = sharp(inputPath, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;

  // Cap very large inputs for free CPU path (same spirit as server max ~12MP)
  const maxSide = 4096;
  if (w > maxSide || h > maxSide) {
    pipeline = pipeline.resize({
      width: w >= h ? maxSide : undefined,
      height: h > w ? maxSide : undefined,
      fit: "inside",
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    });
  }

  pipeline = modePipeline(pipeline, mode || "natural");

  // Prefer JPEG output for Locket-friendly size; keep alpha as PNG
  const hasAlpha = Boolean(meta.hasAlpha);
  let buffer;
  let mime;
  if (hasAlpha) {
    buffer = await pipeline.png({ compressionLevel: 8 }).toBuffer();
    mime = "image/png";
  } else {
    buffer = await pipeline
      .jpeg({ quality: 92, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer();
    mime = "image/jpeg";
  }

  if (!buffer?.length) {
    const err = new Error("Xử lý free không tạo được ảnh.");
    err.code = "PROVIDER_EMPTY";
    throw err;
  }

  return {
    buffer,
    mime,
    model: MODEL_ID,
  };
}

module.exports = { enhanceWithFreeLocal, MODEL_ID };
