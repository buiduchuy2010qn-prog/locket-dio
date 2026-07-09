import { useContext, useEffect, useState } from "react";
import {
  Cloud,
  CloudOff,
  Copy,
  ExternalLink,
  HardDrive,
  Loader2,
  Shield,
} from "lucide-react";
import {
  fetchDriveServerStatus,
  isAdminUser,
} from "@/utils/googleDrive";
import { AuthContext } from "@/context/AuthLocket";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";
import { SonnerSuccess } from "@/components/ui/SonnerToast";

/**
 * CHỈ ADMIN thấy block này (Settings).
 * 1 Google Drive dùng chung cả web — cấu hình env trên Render.
 * User thường: không hiện gì.
 */
export default function GoogleDriveBackup() {
  const { user, authTokens } = useContext(AuthContext);
  const localId = getMyLocalId(user, authTokens);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(() => isAdminUser(localId));

  const load = async () => {
    setLoading(true);
    try {
      const st = await fetchDriveServerStatus(true, localId);
      setStatus(st);
      setIsAdmin(Boolean(st?.isAdmin) || isAdminUser(localId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localId) {
      setLoading(false);
      setIsAdmin(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId]);

  // —— User thường: ẩn hoàn toàn ——
  if (!isAdmin) {
    return null;
  }

  const configured = Boolean(status?.configured);
  const enabled = status?.enabled !== false && configured;

  const copyLocalId = async () => {
    if (!localId) return;
    try {
      await navigator.clipboard.writeText(localId);
      SonnerSuccess("Đã copy localId", "Dán vào ADMIN_LOCAL_IDS trên Render");
    } catch {
      prompt("Copy localId:", localId);
    }
  };

  return (
    <div className="w-full max-w-[600px] mx-auto mt-8 mb-6">
      <div className="flex items-center mb-3 text-base-content">
        <HardDrive className="w-5 h-5 mr-2" />
        <h2 className="text-lg font-semibold">Google Drive (admin)</h2>
        <span className="ml-2 badge badge-primary badge-sm gap-1">
          <Shield className="w-3 h-3" /> chỉ admin
        </span>
      </div>

      <div className="bg-base-200 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm text-base-content/80">
          <strong>1 Drive dùng chung cả web.</strong> Mọi user đăng ảnh/video
          sẽ backup vào folder này — không cần từng người login Google.
        </p>

        <div className="text-xs bg-base-300/60 rounded-xl p-3 space-y-1">
          <p className="font-semibold">Vị trí trên app</p>
          <p>
            Camera → mở <strong>Settings</strong> (tab cài đặt) → cuộn xuống{" "}
            <strong>Google Drive (admin)</strong>
          </p>
        </div>

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
                ? "Backup Drive: đang bật (cả web)"
                : "Backup Drive: chưa liên kết"}
          </span>
        </div>

        {enabled && status?.folderUrl && (
          <a
            href={status.folderUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm btn-outline gap-2 w-full"
          >
            <ExternalLink className="w-4 h-4" />
            Mở folder Google Drive
          </a>
        )}

        {status?.serviceEmail && (
          <p className="text-xs text-success break-all">
            Service Account: {status.serviceEmail}
          </p>
        )}

        <div className="border border-dashed border-primary/40 rounded-xl p-3 space-y-2 text-xs text-base-content/80">
          <p className="font-semibold text-primary flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            Liên kết Drive (cấu hình trên Render — 1 lần)
          </p>
          <ol className="list-decimal pl-4 space-y-1.5">
            <li>
              [Google Cloud Console](https://console.cloud.google.com/) → tạo{" "}
              <strong>Service Account</strong> → bật <strong>Google Drive API</strong>
            </li>
            <li>
              Tải file JSON key → dán vào env Render:{" "}
              <code className="bg-base-300 px-1 rounded">
                GOOGLE_SERVICE_ACCOUNT_JSON
              </code>
            </li>
            <li>
              Trên Google Drive: tạo folder (vd.{" "}
              <em>Locket Dio Web</em>) → Share{" "}
              <strong>Editor</strong> cho email service account
            </li>
            <li>
              Copy Folder ID (trên URL{" "}
              <code className="bg-base-300 px-1 rounded">
                /folders/XXXX
              </code>
              ) → env{" "}
              <code className="bg-base-300 px-1 rounded">
                GOOGLE_DRIVE_FOLDER_ID
              </code>
            </li>
            <li>
              Thêm localId admin vào env (để chỉ bạn thấy mục này):
              <br />
              <code className="bg-base-300 px-1 rounded">
                ADMIN_LOCAL_IDS
              </code>{" "}
              và{" "}
              <code className="bg-base-300 px-1 rounded">
                VITE_ADMIN_LOCAL_IDS
              </code>
            </li>
          </ol>

          {localId && (
            <div className="flex items-center gap-2 mt-2 p-2 bg-base-100 rounded-lg">
              <span className="text-[11px] opacity-70 shrink-0">localId của bạn:</span>
              <code className="text-[11px] truncate flex-1">{localId}</code>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={copyLocalId}
                title="Copy"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn btn-xs btn-primary w-full mt-1"
            onClick={load}
          >
            Kiểm tra liên kết lại
          </button>
        </div>
      </div>
    </div>
  );
}
