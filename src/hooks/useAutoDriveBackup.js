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

    const isVideo =
      (selectedFile.type && String(selectedFile.type).startsWith("video/")) ||
      /\.(mp4|webm|mov|m4v|3gp|avi|mkv)$/i.test(selectedFile.name || "");
    const ext =
      (selectedFile.type && selectedFile.type.split("/")[1]) ||
      (selectedFile.name && selectedFile.name.includes(".")
        ? selectedFile.name.split(".").pop()
        : isVideo
          ? "mp4"
          : "jpg");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `locketdio_capture_${ts}.${ext}`;
    const folderLabel = isVideo ? "Video" : "Ảnh";

    // force=true: không dùng cache cũ (tránh bỏ qua backup)
    fetchDriveServerStatus(true)
      .then((st) => {
        if (!st?.configured || st?.enabled === false) {
          console.warn("[gdrive] skip backup — Drive chưa bật");
          return;
        }
        backupToDriveInBackground(selectedFile, {
          fileName,
          mediaType: isVideo ? "video" : "image",
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
      })
      .catch((e) => {
        console.warn("[gdrive] status failed:", e?.message);
      });
  }, [selectedFile]);
}
