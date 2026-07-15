const sharp = require("sharp");
const heicConvert = require("heic-convert");
const { logSuccess } = require("../logEventUtils");

const logInfo = (tag, message) => {
  console.log(`[${tag.toUpperCase()}] ${message}`);
};

const prepareImageForProcessing = async (imageBuffer) => {
  try {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new Error("Input Buffer is empty");
    }

    let image = sharp(imageBuffer, { failOn: "none" }).rotate(); // Auto-fix
    const metadata = await image.metadata();
    const { format } = metadata;

    logInfo(
      "prepareImage",
      `Detected format: ${format || "unknown"}, bytes=${imageBuffer.length}`,
    );
    const unsupportedFormats = ["heif", "heic"];

    if (unsupportedFormats.includes(format?.toLowerCase())) {
      logInfo(
        "prepareImage",
        `Using heic-convert to convert ${format} to JPEG`,
      );

      const jpegBuffer = await heicConvert({
        buffer: imageBuffer,
        format: "JPEG",
        quality: 1,
      });

      if (!jpegBuffer?.length) {
        throw new Error("HEIC convert produced empty buffer");
      }

      image = sharp(jpegBuffer, { failOn: "none" }).rotate();
      logInfo("prepareImage", "✅ Successfully converted HEIC to JPEG");
    }

    return image;
  } catch (err) {
    logInfo("prepareImage", `Error preparing image: ${err.message}`);
    throw new Error("Cannot prepare image format: " + err.message);
  }
};

/**
 * Encode square WebP from a prepared sharp pipeline (clone-safe).
 */
async function encodeWebp(basePipeline, side, quality) {
  let pipe = basePipeline.clone();
  if (side && side > 0) {
    pipe = pipe.resize(side, side, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    });
  }
  return pipe
    .webp({
      quality,
      alphaQuality: 100,
      // Keep chroma for fine text / edges (smartSubsample blurs detail)
      smartSubsample: false,
      effort: 4,
    })
    .toBuffer();
}

/**
 * Process image for Locket upload — preserve sharpness.
 *
 * - Center-crop square at source resolution
 * - Downscale only if larger than `resolution` (Lanczos3)
 * - Never upscale
 * - WebP start q95, floor q85 before emergency downscale
 * - maxSizeMB default 2.5 (was 1.0 — caused soft recompress)
 */
const processImageBuffer = async ({
  imageBuffer,
  maxSizeMB = 2.5,
  resolution = 1920,
}) => {
  try {
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer) || imageBuffer.length < 32) {
      throw new Error(
        `Input Buffer is empty or too small (${imageBuffer?.length ?? 0} bytes)`,
      );
    }

    logInfo(
      "processImageBuffer",
      "Start processing image (quality-preserving)...",
    );

    let image = await prepareImageForProcessing(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    logInfo("processImageBuffer", `Original size: ${width}x${height}`);

    if (!width || !height) {
      throw new Error("Invalid image dimensions");
    }

    // Center-crop square at source resolution
    const cropSide = Math.min(width, height);
    const left = Math.max(0, Math.floor((width - cropSide) / 2));
    const top = Math.max(0, Math.floor((height - cropSide) / 2));

    const squared = image.extract({
      left,
      top,
      width: cropSide,
      height: cropSide,
    });

    const target = Math.max(720, Math.min(Number(resolution) || 1920, 4096));
    // Output side: native if smaller/equal, else target
    const outSide = cropSide > target ? target : cropSide;

    logInfo(
      "processImageBuffer",
      cropSide > target
        ? `Downscale ${cropSide}px → ${outSide}px (lanczos3)`
        : `Keep native square ${outSide}px (no upscale)`,
    );

    const maxBytes = Math.max(0.5, Number(maxSizeMB) || 2.5) * 1024 * 1024;

    let quality = 95;
    let compressedBuffer;

    while (quality >= 85) {
      compressedBuffer = await encodeWebp(squared, outSide, quality);
      const sizeInMB = (compressedBuffer.length / 1024 / 1024).toFixed(2);
      logInfo(
        "processImageBuffer",
        `WebP quality ${quality} → ${sizeInMB}MB`,
      );
      if (compressedBuffer.length <= maxBytes) break;
      quality -= 5;
    }

    // Soft fallback only if still over budget
    if (compressedBuffer.length > maxBytes && outSide > 1440) {
      logInfo(
        "processImageBuffer",
        `Over budget — resize 1440 @ q90`,
      );
      compressedBuffer = await encodeWebp(squared, 1440, 90);
    }

    if (compressedBuffer.length > maxBytes && outSide > 1080) {
      logInfo(
        "processImageBuffer",
        `Over budget — resize 1080 @ q88`,
      );
      compressedBuffer = await encodeWebp(squared, 1080, 88);
    }

    const finalSize = (compressedBuffer.length / 1024 / 1024).toFixed(2);
    logInfo("processImageBuffer", `✅ Final image size: ${finalSize}MB`);

    logSuccess("processImageBuffer", "✅ End processing image buffer.");
    return compressedBuffer;
  } catch (err) {
    throw new Error("❌ Lỗi xử lý ảnh: " + err.message);
  }
};

module.exports = {
  processImageBuffer,
};
