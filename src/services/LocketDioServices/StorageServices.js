import axios from "axios";
import { CONFIG } from "@/config/webConfig";
import { getToken } from "@/utils";
import { applyMemberHeader } from "@/utils/memberToken";

/**
 * Upload R2 — khớp client chính thức locket-dio.com:
 * POST {filename, contentType, type, size, uploadedAt} → /api/presignedV3
 * PUT file lên uploadUrl
 * return toàn bộ r.data.data
 */
export const uploadFileAndGetInfoR2 = async (
  file,
  previewType = "other",
  localId
) => {
  if (!file) throw new Error("No file provided");

  const safeType = String(previewType || "other").toLowerCase();
  const timestamp = Date.now();
  const rawName = file.name || `capture_${timestamp}.jpg`;
  const extension = rawName.includes(".")
    ? rawName.split(".").pop()
    : safeType === "video"
      ? "mp4"
      : "jpg";
  const contentType =
    file.type ||
    (safeType === "video" ? "video/mp4" : "image/jpeg");

  const fileName = `locketdio_${timestamp}_${localId}_cli${CONFIG.app.clientVersion}.${extension}`;

  // Absolute same-origin path (proxy) — never nest under /dio-api
  const storageBase = (CONFIG.api.storage || "/dio-storage").replace(/\/$/, "");
  const presignUrl = storageBase.startsWith("http")
    ? `${storageBase}/api/presignedV3`
    : `${storageBase.startsWith("/") ? storageBase : "/" + storageBase}/api/presignedV3`;

  const { idToken } = getToken() || {};
  if (!idToken) {
    throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
  }

  // CHỈ các field client chính thức gửi (tránh Malformed request)
  const body = {
    filename: fileName,
    contentType,
    type: safeType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
    "x-api-key": CONFIG.keys.apiKey,
    "x-app-author": CONFIG.app.author,
    "x-app-name": CONFIG.app.shortname,
    "x-app-client": CONFIG.app.clientVersion,
    "x-app-api": CONFIG.app.apiVersion,
    "x-app-env": CONFIG.app.env,
  };
  // Official: X-LocketDio-Member header from session.member_token
  applyMemberHeader(headers);

  let res;
  try {
    res = await axios.post(presignUrl, body, {
      headers,
      withCredentials: true,
      timeout: 60000,
    });
  } catch (err) {
    const data = err?.response?.data;
    const msg =
      data?.message ||
      data?.error?.message ||
      (typeof data?.error === "string" ? data.error : null) ||
      err.message ||
      "Presign failed";
    console.error("❌ Presign failed:", err?.response?.status, data);
    const e = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    e.response = err.response;
    e.status = err?.response?.status;
    throw e;
  }

  const data = res.data?.data || res.data;
  // Official: PUT to uploadUrl (not public url)
  const putUrl = data?.uploadUrl || data?.url;
  if (!putUrl) {
    console.error("Presign response missing uploadUrl:", res.data);
    throw new Error(
      res.data?.message || "Không nhận được uploadUrl từ storage."
    );
  }

  const uploadRes = await fetch(putUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!uploadRes.ok) {
    const t = await uploadRes.text().catch(() => "");
    throw new Error(
      `Upload to R2 failed (${uploadRes.status})${t ? ": " + t.slice(0, 100) : ""}`
    );
  }

  // Official returns full presign payload as mediaInfo base
  return {
    ...data,
    type: safeType,
    // helpers for older code paths
    downloadURL:
      data.publicURL || data.publicUrl || data.url || data.downloadURL,
    metadata: {
      name: fileName,
      size: file.size,
      type: contentType,
      uploadedAt: body.uploadedAt,
      path: data.key || data.path,
    },
  };
};
