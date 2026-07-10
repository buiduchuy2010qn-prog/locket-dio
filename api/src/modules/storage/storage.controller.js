const { tokenUltils } = require("../../utils");
const tempMedia = require("./tempMediaStore");
const { logInfo, logError } = require("../../utils/logEventUtils");

/**
 * POST /api/presignedV3 — self-host temp media (thay storage.locket-dio.com).
 * Client vẫn PUT lên uploadUrl, postMoment tải về qua publicUrl.
 */
const presignedV3 = async (req, res) => {
  try {
    const { filename, contentType, type, size } = req.body || {};
    const uid = req.user?.localId || req.user?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const id = tempMedia.createSlot({
      contentType,
      name: filename,
      size,
      uid,
    });

    const mediaSignature = tokenUltils.signature.generateSignature(id);

    // Public base: same host as API (Render external URL or request host)
    const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https")
      .toString()
      .split(",")[0]
      .trim();
    const host = (
      req.headers["x-forwarded-host"] ||
      req.headers.host ||
      "localhost"
    )
      .toString()
      .split(",")[0]
      .trim();
    const base = `${proto}://${host}`;

    const publicUrl = `${base}/api/media-temp/${id}`;
    const uploadUrl = `${base}/api/media-upload/${id}?sig=${mediaSignature}`;

    logInfo("presignedV3", `Temp slot ${id} for ${uid} (${type || "file"})`);

    return res.status(200).json({
      success: true,
      data: {
        url: publicUrl,
        publicUrl,
        publicURL: publicUrl,
        downloadURL: publicUrl,
        uploadUrl,
        key: id,
        path: id,
        name: filename || id,
        size: Number(size) || 0,
        contentType: contentType || "application/octet-stream",
        type: type || "image",
        mediaSignature,
        expiresIn: Math.floor(tempMedia.TTL_MS / 1000),
      },
    });
  } catch (err) {
    logError("presignedV3", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "presigned failed",
    });
  }
};

/**
 * PUT /api/media-upload/:id?sig= — nhận body binary (như R2 presigned PUT).
 * Không bắt buộc Authorization (sig trong query).
 */
const mediaUpload = async (req, res) => {
  try {
    const { id } = req.params;
    const sig = req.query.sig || "";
    if (!id || !sig) {
      return res.status(400).send("Missing id or sig");
    }
    if (!tokenUltils.signature.verifySignature(id, String(sig))) {
      return res.status(403).send("Invalid signature");
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const result = tempMedia.putBuffer(
      id,
      buffer,
      req.headers["content-type"],
    );
    if (!result.ok) {
      const code =
        result.error === "not_found"
          ? 404
          : result.error === "too_large"
            ? 413
            : 400;
      return res.status(code).send(result.error || "upload failed");
    }

    logInfo("mediaUpload", `Stored ${id} (${buffer.length} bytes)`);
    return res.status(200).send("OK");
  } catch (err) {
    logError("mediaUpload", err.message);
    return res.status(500).send("upload error");
  }
};

/**
 * GET /api/media-temp/:id — public read for postMoment download.
 */
const mediaTempGet = async (req, res) => {
  try {
    const item = tempMedia.get(req.params.id);
    if (!item || !item.ready || !item.buffer) {
      return res.status(404).send("Not found");
    }
    res.setHeader(
      "Content-Type",
      item.contentType || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.status(200).send(item.buffer);
  } catch (err) {
    logError("mediaTempGet", err.message);
    return res.status(500).send("error");
  }
};

module.exports = {
  presignedV3,
  mediaUpload,
  mediaTempGet,
};
