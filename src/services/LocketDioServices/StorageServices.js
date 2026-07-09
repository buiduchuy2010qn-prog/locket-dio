import axios from "axios";
import { CONFIG } from "@/config/webConfig";
import { getToken } from "@/utils";

/**
 * Upload file lên R2 qua presigned URL.
 * Lưu ý: KHÔNG dùng api (baseURL=/dio-api) với path /dio-storage/...
 * vì axios sẽ ghép thành /dio-api/dio-storage/... → 404.
 */
export const uploadFileAndGetInfoR2 = async (
  file,
  previewType = "other",
  localId
) => {
  if (!file) throw new Error("No file provided");

  const safeType = previewType.toLowerCase();
  const timestamp = Date.now();
  const extension = file.name.split(".").pop();
  const fileName = `locketdio_${timestamp}_${localId}_cli${CONFIG.app.clientVersion}.${extension}`;

  const storageBase = (CONFIG.api.storage || "/dio-storage").replace(/\/$/, "");
  // Absolute path on same origin, or full https URL
  const presignUrl = storageBase.startsWith("http")
    ? `${storageBase}/api/presignedV3`
    : `${storageBase.startsWith("/") ? "" : "/"}${storageBase}/api/presignedV3`.replace(
        /\/{2,}/g,
        "/"
      );

  const { idToken } = getToken() || {};
  if (!idToken) {
    throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
  }

  // === Bước 1: Gọi BE để lấy Presigned URL
  const res = await axios.post(
    presignUrl,
    {
      filename: fileName,
      contentType: file.type,
      type: safeType,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
        "x-api-key": CONFIG.keys.apiKey,
        "x-app-author": CONFIG.app.author,
        "x-app-name": CONFIG.app.shortname,
        "x-app-client": CONFIG.app.clientVersion,
        "x-app-api": CONFIG.app.apiVersion,
        "x-app-env": CONFIG.app.env,
      },
      withCredentials: true,
      timeout: 60000,
    }
  );

  const payload = res.data?.data || res.data;
  const url = payload?.url;
  const publicURL = payload?.publicURL || payload?.publicUrl || payload?.downloadURL;
  const key = payload?.key || payload?.path;

  if (!url || !publicURL) {
    console.error("Presign response:", res.data);
    throw new Error("Không nhận được presigned URL từ storage.");
  }

  // === Bước 2: Upload file qua presigned URL (R2/S3 — direct, không qua proxy)
  const uploadRes = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Upload to R2 failed (${uploadRes.status})`);
  }

  return {
    downloadURL: publicURL,
    metadata: {
      name: fileName,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      path: key,
    },
  };
};
