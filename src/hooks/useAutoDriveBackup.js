import { useEffect, useRef } from "react";
import {
  backupToDriveInBackground,
  fetchDriveServerStatus,
} from "@/utils/googleDrive";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";

/**
 * Tự backup Google Drive ngay khi có file (sau chụp / chọn ảnh-video).
 * Toast báo thành công / lỗi — dễ kiểm tra video đã lên chưa.
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
        const fileName = buildDownloadFileName(clean, hint);
        const folderLabel = isVideo ? "Video" : "Ảnh";

        const st = await fetchDriveServerStatus(true);
        if (!st?.configured || st?.enabled === false) {
          console.warn("[gdrive] skip backup — Drive chưa bật");
          return;
        }
        backupToDriveInBackground(clean, {
          fileName,
          mediaType: hint,
          onSuccess: (result) => {
            SonnerSuccess(
              `Đã backup Drive → ${result?.folder || folderLabel}`,
              result?.name || fileName
            );
          },
          onError: (err) => {
            SonnerError(
              "Backup Drive thất bại",
              err?.message || "Thử lại hoặc mở Quản lý Drive"
            );
          },
        });
      } catch (e) {
        console.warn("[gdrive] auto backup setup failed:", e?.message);
      }
    })();
  }, [selectedFile]);
}
