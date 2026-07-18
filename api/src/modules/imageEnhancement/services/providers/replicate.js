const fs = require("fs");
const axios = require("axios");

/**
 * Replicate Real-ESRGAN (or custom REPLICATE_MODEL).
 * Env:
 *   REPLICATE_API_TOKEN
 *   REPLICATE_MODEL (optional versioned model id)
 *
 * Never log image bytes or tokens.
 */
const DEFAULT_MODEL =
  process.env.REPLICATE_MODEL ||
  "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa";

function modeScale(mode) {
  if (mode === "lowlight") return 2;
  if (mode === "portrait") return 2;
  return 2; // natural — mild upscale; model does sharpen/denoise
}

async function enhanceWithReplicate({ inputPath, mode, signal }) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    const err = new Error(
      "Máy chủ chưa cấu hình REPLICATE_API_TOKEN cho AI Làm nét.",
    );
    err.code = "PROVIDER_NOT_CONFIGURED";
    throw err;
  }

  const buf = fs.readFileSync(inputPath);
  const b64 = buf.toString("base64");
  // data URI for Replicate file input
  const dataUri = `data:image/jpeg;base64,${b64}`;

  const createRes = await axios.post(
    "https://api.replicate.com/v1/predictions",
    {
      version: DEFAULT_MODEL.includes(":")
        ? DEFAULT_MODEL.split(":")[1]
        : undefined,
      // Prefer model field when only slug:version not available
      input: {
        image: dataUri,
        scale: modeScale(mode),
        face_enhance: mode === "portrait",
      },
    },
    {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      timeout: 120000,
      signal,
      validateStatus: () => true,
    },
  );

  // If model needs "model" endpoint instead of version:
  if (createRes.status === 404 || createRes.status === 422) {
    // Fallback: models API with owner/name
    const modelSlug = DEFAULT_MODEL.split(":")[0];
    const [owner, name] = modelSlug.split("/");
    const res2 = await axios.post(
      `https://api.replicate.com/v1/models/${owner}/${name}/predictions`,
      {
        input: {
          image: dataUri,
          scale: modeScale(mode),
          face_enhance: mode === "portrait",
        },
      },
      {
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        timeout: 120000,
        signal,
        validateStatus: () => true,
      },
    );
    return finalizePrediction(res2, token, signal);
  }

  return finalizePrediction(createRes, token, signal);
}

function isCreditError(status, msg) {
  const text = String(msg || "").toLowerCase();
  return (
    status === 402 ||
    /insufficient credit|payment required|billing|out of credit|not enough credit|spend limit/i.test(
      text,
    )
  );
}

async function finalizePrediction(createRes, token, signal) {
  if (createRes.status >= 400) {
    const msg =
      createRes.data?.detail ||
      createRes.data?.error ||
      `Replicate HTTP ${createRes.status}`;
    const text = typeof msg === "string" ? msg : "Provider từ chối yêu cầu.";
    if (isCreditError(createRes.status, text)) {
      const err = new Error(
        "AI Cloud hiện không đủ credit. Bạn có thể dùng chế độ miễn phí trên thiết bị.",
      );
      err.code = "INSUFFICIENT_CREDIT";
      throw err;
    }
    const err = new Error(text);
    err.code = "PROVIDER_ERROR";
    throw err;
  }

  let pred = createRes.data;
  // Poll if not finished (Prefer: wait may still return processing)
  let attempts = 0;
  while (
    pred &&
    (pred.status === "starting" || pred.status === "processing") &&
    attempts < 40
  ) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await axios.get(pred.urls?.get || `https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Token ${token}` },
      timeout: 30000,
      signal,
    });
    pred = poll.data;
    attempts += 1;
  }

  if (pred.status !== "succeeded") {
    const failMsg = pred.error || "AI không hoàn tất.";
    if (isCreditError(0, failMsg)) {
      const err = new Error(
        "AI Cloud hiện không đủ credit. Bạn có thể dùng chế độ miễn phí trên thiết bị.",
      );
      err.code = "INSUFFICIENT_CREDIT";
      throw err;
    }
    const err = new Error(failMsg);
    err.code = "PROVIDER_FAILED";
    throw err;
  }

  const out = pred.output;
  const url = Array.isArray(out) ? out[0] : out;
  if (!url || typeof url !== "string") {
    const err = new Error("Provider không trả URL kết quả.");
    err.code = "PROVIDER_EMPTY";
    throw err;
  }

  const imgRes = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120000,
    signal,
  });
  return {
    buffer: Buffer.from(imgRes.data),
    mime: imgRes.headers["content-type"] || "image/jpeg",
    model: DEFAULT_MODEL.split(":")[0],
  };
}

module.exports = { enhanceWithReplicate, DEFAULT_MODEL };
