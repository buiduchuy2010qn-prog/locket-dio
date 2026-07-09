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
    "x-app-env": CONFIG.app.env || "production",
  };
  // Official storage axios: Authorization + X-LocketDio-Member + x-app-*
  applyMemberHeader(headers);
  if (!headers["X-LocketDio-Member"] && !Object.keys(headers).some((k) =>
    k.toLowerCase() === "x-locketdio-member"
  )) {
    throw new Error(
      "Thiếu member token (X-LocketDio-Member). Đăng xuất rồi đăng nhập lại để tải /api/cn."
    );
  }

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

  // Dio may return HTTP 200 with success:false + "Malformed request"
  if (res.data?.success === false) {
    const msg =
      res.data?.message ||
      res.data?.error?.message ||
      (typeof res.data?.error === "string" ? res.data.error : null) ||
      "Presign rejected";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  const data = res.data?.data || res.data;
  // Official: PUT to uploadUrl only (never fall back to public url for PUT)
  const putUrl = data?.uploadUrl;
  if (!putUrl) {
    console.error("Presign response missing uploadUrl:", res.data);
    throw new Error(
      res.data?.message || "Không nhận được uploadUrl từ storage."
    );
  }

  if (!file.size && !(file instanceof Blob)) {
    throw new Error("File rỗng — không upload được lên storage.");
  }

  // Browser PUT to R2 is CORS-blocked on non-locket-dio.com origins.
  // Official client: fetch(uploadUrl, { method:"PUT", headers:{Content-Type:file.type}, body:file })
  // We proxy via same-origin so onrender.com works.
  let uploadRes;
  try {
    uploadRes = await fetch("/dio-r2-put", {
      method: "PUT",
      headers: {
        // Match presign contentType exactly (signature often binds Content-Type)
        "Content-Type": contentType,
        "X-Upload-Url": putUrl,
        "X-Upload-Size": String(file.size || 0),
      },
      body: file,
    });
  } catch (netErr) {
    console.error("❌ R2 proxy PUT network error:", netErr);
    throw new Error(
      netErr?.message ||
        "Failed to fetch — không upload được file lên storage (CORS/proxy)."
    );
  }

  if (!uploadRes.ok) {
    const t = await uploadRes.text().catch(() => "");
    throw new Error(
      `Upload to R2 failed (${uploadRes.status})${t ? ": " + t.slice(0, 160) : ""}`
    );
  }

  // Official returns full r.data.data as mediaInfo base
  // (url, uploadUrl, key, expiresIn, …) + type
  const publicUrl =
    data.url || data.publicURL || data.publicUrl || data.downloadURL || null;

  if (!publicUrl) {
    console.warn("Presign missing public url field:", data);
  }

  return {
    ...data,
    url: publicUrl,
    type: safeType,
    // helpers (stripped in PayloadServices before post)
    downloadURL: publicUrl,
    metadata: {
      name: fileName,
      size: file.size,
      type: contentType,
      uploadedAt: body.uploadedAt,
      path: data.key || data.path,
    },
  };
};
