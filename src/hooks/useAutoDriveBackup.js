import { useEffect, useRef } from "react";
import {
  backupToDriveInBackground,
  fetchDriveServerStatus,
} from "@/utils/googleDrive";

/**
 * Tự backup Google Drive ngay khi có file (sau chụp / chọn ảnh-video).
 * Không chặn UI; chỉ chạy nếu admin đã cấu hình Drive.
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

    // Prefetch status (cache) rồi backup nền → folder Ảnh hoặc Video
    fetchDriveServerStatus(false)
      .then((st) => {
        if (!st?.configured || st?.enabled === false) return;
        backupToDriveInBackground(selectedFile, {
          fileName,
          mediaType: isVideo ? "video" : "image",
        });
      })
      .catch(() => {
        /* offline / chưa cấu hình — bỏ qua */
      });
  }, [selectedFile]);
}
