import { useContext, useEffect, useState } from "react";
import { Cloud, CloudOff, HardDrive, Loader2, Shield } from "lucide-react";
import {
  fetchDriveServerStatus,
  isAdminUser,
} from "@/utils/googleDrive";
import { AuthContext } from "@/context/AuthLocket";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";

/**
 * 1 Google Drive dùng chung cho cả web — chỉ admin cấu hình (env server).
 * User thường chỉ thấy trạng thái bật/tắt.
 */
export default function GoogleDriveBackup() {
  const { user, authTokens } = useContext(AuthContext);
  const localId = getMyLocalId(user, authTokens);
  const isAdmin = isAdminUser(localId);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const st = await fetchDriveServerStatus(true);
      setStatus(st);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const configured = Boolean(status?.configured);
  const enabled = status?.enabled !== false && configured;

  return (
    <div className="w-full max-w-[600px] mx-auto mt-8 mb-6">
      <div className="flex items-center mb-3 text-base-content">
        <HardDrive className="w-5 h-5 mr-2" />
        <h2 className="text-lg font-semibold">Google Drive (cả web)</h2>
      </div>

      <div className="bg-base-200 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm text-base-content/80">
          Ảnh/video đăng trên web được backup vào{" "}
          <strong>một Google Drive chung</strong> do admin cấu hình. Không cần
          từng user đăng nhập Google.
        </p>

        <div className="flex items-center gap-2 text-sm">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : enabled ? (
            <Cloud className="w-4 h-4 text-success" />
          ) : (
            <CloudOff className="w-4 h-4 text-warning" />
          )}
          <span>
            {loading
              ? "Đang kiểm tra…"
              : enabled
                ? "Backup Drive: đang bật"
                : "Backup Drive: chưa cấu hình"}
          </span>
        </div>

        {enabled && status?.folderHint && (
          <p className="text-xs text-base-content/60">
            Folder: {status.folderHint}
          </p>
        )}

        {isAdmin ? (
          <div className="border border-dashed border-primary/40 rounded-xl p-3 space-y-2 text-xs text-base-content/80">
            <p className="flex items-center gap-1 font-semibold text-primary">
              <Shield className="w-3.5 h-3.5" /> Admin — cấu hình trên Render
            </p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                Google Cloud → tạo <strong>Service Account</strong>, bật{" "}
                <strong>Drive API</strong>
              </li>
              <li>
                Tải JSON key → dán vào env{" "}
                <code className="bg-base-300 px-1 rounded">
                  GOOGLE_SERVICE_ACCOUNT_JSON
                </code>
              </li>
              <li>
                Tạo folder Drive (vd. Locket Dio Web) → Share cho email service
                account (Editor)
              </li>
              <li>
                Copy Folder ID vào env{" "}
                <code className="bg-base-300 px-1 rounded">
                  GOOGLE_DRIVE_FOLDER_ID
                </code>
              </li>
              <li>
                (Tuỳ chọn){" "}
                <code className="bg-base-300 px-1 rounded">
                  VITE_ADMIN_LOCAL_IDS
                </code>{" "}
                = localId admin (để hiện hướng dẫn này)
              </li>
            </ol>
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={load}
            >
              Kiểm tra lại
            </button>
            {status?.error && (
              <p className="text-error">{status.error}</p>
            )}
            {status?.serviceEmail && (
              <p className="text-success">
                SA: {status.serviceEmail}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-base-content/50">
            Chỉ admin liên kết Drive. User đăng bài sẽ tự backup nếu admin đã
            bật.
          </p>
        )}
      </div>
    </div>
  );
}
