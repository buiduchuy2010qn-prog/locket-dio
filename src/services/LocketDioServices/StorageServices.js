import axios from "axios";
import { CONFIG } from "@/config/webConfig";
import { getToken } from "@/utils";
import {
  applyMemberHeader,
  clearMemberSession,
  getMemberSession,
  saveMemberSession,
} from "@/utils/memberToken";
import { formatApiError } from "@/utils/formatApiError";

/** Dio/R2 hay chối MIME lạ từ camera (quicktime, 3gpp…) — chuẩn hóa an toàn */
function normalizeContentType(file, safeType) {
  const raw = (file?.type && String(file.type).trim()) || "";
  const lower = raw.toLowerCase();

  if (safeType === "video") {
    if (
      !lower ||
      lower === "application/octet-stream" ||
      lower.includes("quicktime") ||
      lower.includes("x-m4v") ||
      lower.includes("3gpp") ||
      lower.includes("3gp")
    ) {
      return "video/mp4";
    }
    if (lower.startsWith("video/")) return lower;
    return "video/mp4";
  }

  if (
    !lower ||
    lower === "application/octet-stream" ||
    lower === "image/jpg"
  ) {
    return "image/jpeg";
  }
  if (lower.startsWith("image/")) {
    return lower === "image/jpg" ? "image/jpeg" : lower;
  }
  return "image/jpeg";
}

function extensionFor(file, safeType, contentType) {
  const rawName = file?.name || "";
  if (rawName.includes(".")) {
    const ext = rawName.split(".").pop()?.toLowerCase();
    if (ext && ext.length <= 5 && /^[a-z0-9]+$/.test(ext)) {
      // .mov / .qt → mp4 khi đã ép mime mp4
      if (safeType === "video" && (ext === "mov" || ext === "qt" || ext === "3gp")) {
        return "mp4";
      }
      if (ext === "jpg") return "jpeg";
      return ext;
    }
  }
  if (safeType === "video") {
    if (contentType.includes("webm")) return "webm";
    return "mp4";
  }
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

/** Làm mới member token (bắt buộc presign) — hết hạn hay mất hay bị 403 */
async function ensureMemberToken(idToken, force = false) {
  const { token } = getMemberSession();
  if (token && !force) return true;

  try {
    const base = (CONFIG.api.baseUrl || "/dio-api").replace(/\/$/, "");
    const url = base.startsWith("http")
      ? `${base}/api/cn`
      : `${base.startsWith("/") ? base : "/" + base}/api/cn`;
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "x-api-key": CONFIG.keys.apiKey,
        "x-app-author": CONFIG.app.author,
        "x-app-name": CONFIG.app.shortname,
        "x-app-client": CONFIG.app.clientVersion,
        "x-app-api": CONFIG.app.apiVersion,
        "x-app-env": CONFIG.app.env || "production",
      },
      withCredentials: true,
      timeout: 20000,
    });
    const data = res.data?.data ?? res.data;
    if (data?.session) saveMemberSession(data.session);
    if (data?.member_token) saveMemberSession(data);
    if (data?.plan_info?.session) saveMemberSession(data.plan_info.session);
    if (res.data?.session) saveMemberSession(res.data.session);
  } catch (e) {
    console.warn("[storage] refresh member token failed:", e?.message);
  }
  return Boolean(getMemberSession().token);
}

function mapUploadError(err, phase) {
  const status = err?.response?.status || err?.status;
  const raw = formatApiError(err, phase || "Upload failed");
  const lower = String(raw).toLowerCase();

  if (status === 401 || /token|unauthorized|hết hạn|expired/i.test(lower)) {
    return "Phiên đăng nhập hết hạn hoặc token sai. Đăng xuất rồi đăng nhập lại.";
  }
  if (
    status === 403 ||
    /forbidden|permission|denied|member|gói|plan|quota|không có quyền/i.test(
      lower
    )
  ) {
    // Dio hay trả message mơ hồ "ok" kèm 403
    if (/^403:\s*ok$/i.test(raw.trim()) || lower === "ok" || /403:\s*ok/i.test(raw)) {
      return "Bị từ chối (403). Thường do: hết member token / gói không cho video / cần đăng nhập lại. Hãy Đăng xuất → Đăng nhập lại rồi thử.";
    }
    return `Không có quyền upload (${raw}). Thử đăng nhập lại hoặc kiểm tra gói thành viên.`;
  }
  if (status === 413 || /too large|quá lớn/i.test(lower)) {
    return "File quá lớn. Nén video nhỏ hơn rồi thử lại.";
  }
  return raw;
}

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
  const contentType = normalizeContentType(file, safeType);
  const extension = extensionFor(file, safeType, contentType);

  const fileName = `locketdio_${timestamp}_${localId}_cli${CONFIG.app.clientVersion}.${extension}`;

  const storageBase = (CONFIG.api.storage || "/dio-storage").replace(/\/$/, "");
  const presignUrl = storageBase.startsWith("http")
    ? `${storageBase}/api/presignedV3`
    : `${storageBase.startsWith("/") ? storageBase : "/" + storageBase}/api/presignedV3`;

  const { idToken } = getToken() || {};
  if (!idToken) {
    throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
  }

  await ensureMemberToken(idToken);

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
      timeout: safeType === "video" ? 120000 : 60000,
    });
  } catch (err) {
    console.error(
      "❌ Presign failed:",
      err?.response?.status,
      err?.response?.data
    );
    // 403 member hết hạn → thử refresh 1 lần rồi presign lại
    if (err?.response?.status === 403) {
      try {
        // Xóa token cũ hỏng (nếu có) rồi lấy lại từ /api/cn
        clearMemberSession();
        await ensureMemberToken(idToken, true);
        applyMemberHeader(headers);
        if (
          headers["X-LocketDio-Member"] ||
          Object.keys(headers).some(
            (k) => k.toLowerCase() === "x-locketdio-member"
          )
        ) {
          res = await axios.post(presignUrl, body, {
            headers,
            withCredentials: true,
            timeout: safeType === "video" ? 120000 : 60000,
          });
        } else {
          throw err;
        }
      } catch (retryErr) {
        const e = new Error(mapUploadError(retryErr || err, "Presign failed"));
        e.response = (retryErr || err).response;
        e.status = (retryErr || err)?.response?.status;
        throw e;
      }
    } else {
      const e = new Error(mapUploadError(err, "Presign failed"));
      e.response = err.response;
      e.status = err?.response?.status;
      throw e;
    }
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
    if (uploadRes.status === 403) {
      throw new Error(
        "Upload storage bị chặn (403). Thường do Content-Type/chữ ký R2. Thử video MP4 khác hoặc đăng nhập lại."
      );
    }
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
