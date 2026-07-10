import { CONFIG } from "@/config/webConfig";
import { instanceBaseStorage } from "@/libs";

/**
 * Ưu tiên upload qua same-origin /dio-api (proxy) để body binary
 * luôn vào đúng API instance + tránh CORS/host sai.
 */
function resolveUploadUrl(data) {
  if (typeof window !== "undefined" && data?.proxyUploadUrl) {
    return data.proxyUploadUrl.startsWith("http")
      ? data.proxyUploadUrl
      : `${window.location.origin}${data.proxyUploadUrl}`;
  }
  const raw = data?.uploadUrl || "";
  if (typeof window !== "undefined" && raw) {
    try {
      const u = new URL(raw, window.location.origin);
      if (u.pathname.includes("/api/media-upload/")) {
        // Ép qua proxy /dio-api
        return `${window.location.origin}/dio-api${u.pathname}${u.search}`;
      }
    } catch {
      /* keep raw */
    }
  }
  return raw;
}

function resolvePublicUrls(data) {
  // Server postMoment ưu tiên path id trong temp store; publicUrl vẫn cần fallback
  const pathId = data?.path || data?.key;
  let publicUrl = data?.publicUrl || data?.url || data?.downloadURL;
  if (typeof window !== "undefined" && pathId) {
    // Same-origin đọc được qua proxy nếu cần
    const proxy = `${window.location.origin}/dio-api/api/media-temp/${pathId}`;
    // Giữ absolute API url nếu có; thêm proxy làm backup field
    return {
      ...data,
      publicUrl: publicUrl || proxy,
      publicURL: publicUrl || proxy,
      downloadURL: publicUrl || proxy,
      url: publicUrl || proxy,
      proxyPublicUrl: proxy,
      path: pathId,
      key: pathId,
    };
  }
  return data;
}

export const uploadFileAndGetInfoR2 = async (
  file,
  previewType = "other",
  localId,
) => {
  if (!file) throw new Error("No file provided");
  if (!file.size) throw new Error("File rỗng — hãy chụp/chọn lại");

  const safeType = previewType.toLowerCase(); // image / video / other
  const timestamp = Date.now();
  const extension = file.name?.split(".").pop() || "jpg";

  const fileName = `huylocket_${timestamp}_${localId}_cli${CONFIG.app.clientVersion}.${extension}`;

  const body = {
    filename: fileName,
    contentType: file.type || "image/jpeg",
    type: safeType,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  };

  // === Bước 1: Gọi BE để lấy Presigned URL
  const res = await instanceBaseStorage.post("/api/presignedV3", body);
  const data = res.data?.data;
  if (!data) throw new Error("presignedV3: no data");

  const uploadUrl = resolveUploadUrl(data);
  if (!uploadUrl) throw new Error("presignedV3: missing uploadUrl");

  // === Bước 2: Upload binary
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!uploadRes.ok) {
    const t = await uploadRes.text().catch(() => "");
    throw new Error(
      `Upload media failed (${uploadRes.status})${t ? `: ${t.slice(0, 120)}` : ""}`,
    );
  }

  return resolvePublicUrls({
    ...data,
    size: file.size,
    name: fileName,
    type: safeType,
    contentType: file.type || data.contentType,
  });
};