import axios from "axios";
import { CONFIG } from "@/config/webConfig";
import { getToken } from "@/utils";

function guessExt(file, previewType) {
  const fromName = file?.name?.includes(".")
    ? file.name.split(".").pop()?.toLowerCase()
    : "";
  if (fromName && fromName.length <= 5) return fromName;
  if (previewType === "video") return "mp4";
  const t = (file?.type || "").toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  if (t.includes("mp4")) return "mp4";
  if (t.includes("webm")) return "webm";
  return "jpg";
}

function resolveContentType(file, previewType) {
  if (file?.type) return file.type;
  return previewType === "video" ? "video/mp4" : "image/jpeg";
}

/**
 * Upload file lên R2 qua presigned URL.
 * Dùng path /dio-storage (absolute) — không qua axios baseURL /dio-api.
 */
export const uploadFileAndGetInfoR2 = async (
  file,
  previewType = "other",
  localId
) => {
  if (!file) throw new Error("No file provided");

  const safeType =
    previewType === "video" || previewType === "image"
      ? previewType
      : (file.type || "").startsWith("video")
        ? "video"
        : "image";

  const timestamp = Date.now();
  const extension = guessExt(file, safeType);
  const contentType = resolveContentType(file, safeType);
  const fileName = `locketdio_${timestamp}_${localId}_cli${CONFIG.app.clientVersion}.${extension}`;

  const storageBase = (CONFIG.api.storage || "/dio-storage").replace(/\/$/, "");
  const presignUrl = storageBase.startsWith("http")
    ? `${storageBase}/api/presignedV3`
    : `/${storageBase.replace(/^\//, "")}/api/presignedV3`;

  const { idToken } = getToken() || {};
  if (!idToken) {
    throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
  }

  const body = {
    filename: fileName,
    fileName,
    contentType,
    content_type: contentType,
    mimeType: contentType,
    type: safeType,
    size: Number(file.size) || 0,
    uploadedAt: new Date().toISOString(),
    userId: localId,
    localId,
  };

  let res;
  try {
    res = await axios.post(presignUrl, body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
        "x-api-key": CONFIG.keys.apiKey || "",
        "x-app-author": CONFIG.app.author,
        "x-app-name": CONFIG.app.shortname,
        "x-app-client": CONFIG.app.clientVersion,
        "x-app-api": CONFIG.app.apiVersion,
        "x-app-env": CONFIG.app.env,
      },
      withCredentials: true,
      timeout: 60000,
    });
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Presign failed";
    const status = err?.response?.status;
    console.error("❌ Presign failed:", status, err?.response?.data || err.message);
    const e = new Error(
      typeof msg === "string" ? msg : JSON.stringify(msg)
    );
    e.response = err.response;
    e.status = status;
    throw e;
  }

  const payload = res.data?.data || res.data;
  const url = payload?.url || payload?.uploadUrl || payload?.signedUrl;
  const publicURL =
    payload?.publicURL ||
    payload?.publicUrl ||
    payload?.downloadURL ||
    payload?.downloadUrl;
  const key = payload?.key || payload?.path || payload?.filePath;

  if (!url || !publicURL) {
    console.error("Presign response:", res.data);
    throw new Error(
      res.data?.message ||
        res.data?.error ||
        "Không nhận được presigned URL từ storage."
    );
  }

  const uploadRes = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!uploadRes.ok) {
    const t = await uploadRes.text().catch(() => "");
    throw new Error(
      `Upload to R2 failed (${uploadRes.status})${t ? ": " + t.slice(0, 120) : ""}`
    );
  }

  return {
    downloadURL: publicURL,
    metadata: {
      name: fileName,
      size: file.size,
      type: contentType,
      uploadedAt: new Date().toISOString(),
      path: key,
    },
  };
};
