import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { CloudUpload, Download } from "lucide-react";
import {
  fetchDriveServerStatus,
  isDriveConfigured,
  uploadFileToGoogleDrive,
} from "@/utils/googleDrive";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";

const HeaderAfterCapture = ({ selectedFile }) => {
  const { navigation } = useApp();
  const { setIsSidebarOpen, setFriendsTabOpen } = navigation;
  const [savingDrive, setSavingDrive] = useState(false);

  const handleDownload = async () => {
    if (!selectedFile) return;

    try {
      await fetchDriveServerStatus(false);
    } catch {
      /* ignore */
    }

    if (isDriveConfigured()) {
      setSavingDrive(true);
      try {
        const extension = selectedFile.type?.split("/")[1] || "jpg";
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const defaultName = `locketdio-${timestamp}.${extension}`;
        const res = await uploadFileToGoogleDrive(selectedFile, {
          fileName: defaultName,
        });
        SonnerSuccess(
          "Đã lưu Google Drive (web)",
          res?.name || "Drive chung"
        );
        return;
      } catch (err) {
        SonnerError(err?.message || "Lưu Drive thất bại — tải về máy");
      } finally {
        setSavingDrive(false);
      }
    }

    const url = URL.createObjectURL(selectedFile);

    const extension = selectedFile.type.split("/")[1] || "png";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const defaultName = `locketdio-${timestamp}.${extension}`;

    const link = document.createElement("a");
    link.href = url;
    link.download = defaultName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
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
          disabled={savingDrive}
          className="w-11 h-11 flex items-center justify-center hover:bg-base-300 rounded-full transition disabled:opacity-50"
        >
          {isDriveConfigured() ? (
            <CloudUpload size={28} strokeWidth={2} />
          ) : (
            <Download size={28} strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
};

export default HeaderAfterCapture;
