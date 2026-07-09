import { useEffect, useRef } from "react";
import {
  backupToDriveInBackground,
  fetchDriveServerStatus,
} from "@/utils/googleDrive";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";
import { getToken } from "@/utils";

/**
 * Mọi user chụp/chọn media → backup lên Drive admin (server Render + Neon OAuth).
 * Không phụ thuộc máy admin bật — chạy qua API web.
 */
export function useAutoDriveBackup(selectedFile) {
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!selectedFile) {
      lastKeyRef.current = "";
      return;
    }

    const key = [
      selectedFile.name || "",
      selectedFile.size || 0,
      selectedFile.lastModified || 0,
      selectedFile.type || "",
    ].join("|");

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    (async () => {
      try {
        const { buildDownloadFileName, normalizeMediaFile } = await import(
          "@/utils/mediaFileName"
        );
        const isVideo =
          (selectedFile.type &&
            String(selectedFile.type).startsWith("video/")) ||
          /\.(mp4|webm|mov|m4v|3gp|avi|mkv)$/i.test(selectedFile.name || "");
        const hint = isVideo ? "video" : "image";
        const clean = normalizeMediaFile(selectedFile, hint);
        let fileName = buildDownloadFileName(clean, hint);

        // Gắn uid người đăng để admin biết file của ai (Drive chung)
        try {
          const { localId } = getToken() || {};
          const uid = localId ? String(localId).slice(0, 12) : "guest";
          if (!fileName.includes(uid)) {
            const dot = fileName.lastIndexOf(".");
            fileName =
              dot > 0
                ? `${fileName.slice(0, dot)}_${uid}${fileName.slice(dot)}`
                : `${fileName}_${uid}`;
          }
        } catch {
          /* ignore */
        }

        const folderLabel = isVideo ? "Video" : "Ảnh";

        const st = await fetchDriveServerStatus(true);
        if (!st?.configured || st?.enabled === false) {
          console.warn("[gdrive] skip backup — Drive chưa bật (admin liên kết 1 lần trên Render)");
          return;
        }

        let attempt = 0;
        const maxAttempts = 2;
        const tryBackup = () => {
          attempt += 1;
          backupToDriveInBackground(clean, {
            fileName,
            mediaType: hint,
            onSuccess: (result) => {
              SonnerSuccess(
                `Đã backup Drive admin → ${result?.folder || folderLabel}`,
                result?.name || fileName
              );
            },
            onError: (err) => {
              if (attempt < maxAttempts) {
                console.warn("[gdrive] retry backup", attempt, err?.message);
                setTimeout(tryBackup, 1500 * attempt);
                return;
              }
              SonnerError(
                "Backup Drive thất bại",
                err?.message || "Thử lại sau hoặc admin kiểm tra OAuth Drive"
              );
            },
          });
        };
        tryBackup();
      } catch (e) {
        console.warn("[gdrive] auto backup setup failed:", e?.message);
      }
    })();
  }, [selectedFile]);
}
