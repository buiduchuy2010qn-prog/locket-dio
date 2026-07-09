import { Download } from "lucide-react";
import { useAutoDriveBackup } from "@/hooks/useAutoDriveBackup";
import { SonnerSuccess } from "@/components/ui/SonnerToast";

const HeaderAfterCapture = ({ selectedFile }) => {
  // Drive: tự backup ngay sau khi chụp / chọn file
  useAutoDriveBackup(selectedFile);

  /** Chỉ tải về máy — tên + MIME sạch */
  const handleDownload = async () => {
    if (!selectedFile) return;
    const { buildDownloadFileName, normalizeMediaFile } = await import(
      "@/utils/mediaFileName"
    );
    const hint =
      selectedFile.type?.startsWith("video/") ||
      /\.(mp4|webm|mov)$/i.test(selectedFile.name || "")
        ? "video"
        : "image";
    const file = normalizeMediaFile(selectedFile, hint);
    const defaultName = buildDownloadFileName(file, hint);
    const url = URL.createObjectURL(file);

    const link = document.createElement("a");
    link.href = url;
    link.download = defaultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    SonnerSuccess("Đã tải về máy", defaultName);
  };

  return (
    <div
      className={`navbar top-0 left-0 w-full px-4 py-2 flex items-center justify-between z-50 relative transition-opacity duration-500 ${
        selectedFile ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="w-11 h-11" />

      <div className="absolute flex justify-center items-center flex-row gap-1 left-1/2 transform -translate-x-1/2 text-lg font-semibold text-base-content">
        Gửi đến...
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleDownload}
          title="Tải về máy"
          className="w-11 h-11 flex items-center justify-center hover:bg-base-300 rounded-full transition"
        >
          <Download size={28} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

export default HeaderAfterCapture;
