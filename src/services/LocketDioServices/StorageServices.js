import axios from "axios";
import { CONFIG } from "@/config/webConfig";
import { getToken } from "@/utils";
import { applyMemberHeader } from "@/utils/memberToken";
import { formatApiError } from "@/utils/formatApiError";

/**
 * Upload R2 — khớp client chính thức locket-dio.com:
 * POST {filename, contentType, type, size, uploadedAt} → /api/presignedV3
 * PUT file lên uploadUrl (qua /dio-r2-put vì CORS onrender)
 * return toàn bộ r.data.data (+ type)
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

  // Official: contentType = file.type (không fallback khác nhau giữa presign và PUT)
  // Camera File luôn có type image/jpeg — nếu trống mới fallback
  const contentType =
    (file.type && String(file.type).trim()) ||
    (safeType === "video" ? "video/mp4" : "image/jpeg");

  const fileName = `locketdio_${timestamp}_${localId}_cli${CONFIG.app.clientVersion}.${extension}`;

  const storageBase = (CONFIG.api.storage || "/dio-storage").replace(/\/$/, "");
  const presignUrl = storageBase.startsWith("http")
    ? `${storageBase}/api/presignedV3`
    : `${storageBase.startsWith("/") ? storageBase : "/" + storageBase}/api/presignedV3`;

  const { idToken } = getToken() || {};
  if (!idToken) {
    throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
  }

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
  applyMemberHeader(headers);
  if (
    !headers["X-LocketDio-Member"] &&
    !Object.keys(headers).some((k) => k.toLowerCase() === "x-locketdio-member")
  ) {
    throw new Error(
      "Thiếu member token (X-LocketDio-Member). Đăng xuất rồi đăng nhập lại."
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
    console.error("❌ Presign failed:", err?.response?.status, err?.response?.data);
    const e = new Error(formatApiError(err, "Presign failed"));
    e.response = err.response;
    e.status = err?.response?.status;
    throw e;
  }

  if (res.data?.success === false) {
    throw new Error(formatApiError({ response: res }, "Presign rejected"));
  }

  const data = res.data?.data || res.data;
  const putUrl = data?.uploadUrl;
  if (!putUrl) {
    console.error("Presign response missing uploadUrl:", res.data);
    throw new Error(
      res.data?.message || "Không nhận được uploadUrl từ storage."
    );
  }

  const fileSize = file.size ?? (file instanceof Blob ? file.size : 0);
  if (!fileSize) {
    throw new Error("File rỗng — không upload được lên storage.");
  }

  // Public read URL — KHÔNG dùng uploadUrl (PUT-only → Dio GET sẽ 404)
  const publicUrl = pickPublicMediaUrl(data);
  if (!publicUrl) {
    console.error("Presign missing public url:", data);
    throw new Error(
      "Presign không trả URL công khai (url). Thử đăng xuất/đăng nhập lại."
    );
  }

  // Proxy R2: URL qua query (tránh header dài bị cắt) + header backup
  // Content-Type PHẢI khớp đúng contentType đã presign
  let uploadRes;
  try {
    const qs = new URLSearchParams({
      url: putUrl,
      ct: contentType,
    });
    uploadRes = await fetch(`/dio-r2-put?${qs.toString()}`, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "X-Upload-Url": putUrl,
        "X-Upload-Size": String(fileSize),
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
    console.error("❌ R2 PUT failed", uploadRes.status, t.slice(0, 300));
    throw new Error(
      `Upload to R2 failed (${uploadRes.status})${t ? ": " + t.slice(0, 160) : ""}`
    );
  }

  console.log("[storage] R2 OK", {
    status: uploadRes.status,
    bytes: fileSize,
    contentType,
    publicUrl: publicUrl.slice(0, 80),
    key: data.key,
  });

  // Official: mediaInfo = full r.data.data + type
  // Đảm bảo url là public GET URL (không phải uploadUrl)
  return {
    ...data,
    url: publicUrl,
    publicURL: data.publicURL || publicUrl,
    publicUrl: data.publicUrl || publicUrl,
    type: safeType,
    size: data.size ?? fileSize,
    contentType: data.contentType || contentType,
    // helpers (bị strip trước post)
    downloadURL: publicUrl,
    metadata: {
      name: fileName,
      size: fileSize,
      type: contentType,
      uploadedAt: body.uploadedAt,
      path: data.key || data.path,
    },
  };
};

/** Chọn URL Dio có thể GET (không lấy presigned PUT) */
function pickPublicMediaUrl(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [
    data.url,
    data.publicURL,
    data.publicUrl,
    data.downloadURL,
    data.downloadUrl,
    data.cdnUrl,
    data.cdn_url,
  ].filter((u) => typeof u === "string" && u.startsWith("http"));

  const upload = typeof data.uploadUrl === "string" ? data.uploadUrl : "";

  // Ưu tiên URL khác uploadUrl (GET public)
  for (const u of candidates) {
    if (upload && u === upload) continue;
    // uploadUrl thường có X-Amz-Signature / query dài
    if (/X-Amz-Signature|X-Amz-Credential|Signature=/i.test(u) && upload) {
      continue;
    }
    return u;
  }

  // fallback: url dù trùng (một số API chỉ trả 1 field)
  if (candidates.length) return candidates[0];
  return null;
}
