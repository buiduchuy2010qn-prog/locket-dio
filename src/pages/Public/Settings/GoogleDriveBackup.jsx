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

function pickUserEmail(user, authTokens) {
  return (
    user?.email ||
    user?.Email ||
    user?.mail ||
    authTokens?.email ||
    localStorage.getItem("email") ||
    sessionStorage.getItem("email") ||
    ""
  );
}

/**
 * CHỈ admin (gmail buiduchuy2010qn@gmail.com) thấy.
 * 1 Drive dùng chung cả web.
 */
export default function GoogleDriveBackup() {
  const { user, authTokens } = useContext(AuthContext);
  const localId = getMyLocalId(user, authTokens);
  const email = pickUserEmail(user, authTokens);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(() =>
    isAdminUser(localId, { ...user, email, localId })
  );

  const load = async () => {
    setLoading(true);
    try {
      const st = await fetchDriveServerStatus(true, localId, email);
      setStatus(st);
      setIsAdmin(
        Boolean(st?.isAdmin) ||
          isAdminUser(localId, { ...user, email, localId })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId, email]);

  // User thường: ẩn hoàn toàn
  if (!isAdmin) {
    return null;
  }

  const configured = Boolean(status?.configured);
  const enabled = status?.enabled !== false && configured;

  const copyEmail = async () => {
    const v = email || "buiduchuy2010qn@gmail.com";
    try {
      await navigator.clipboard.writeText(v);
      SonnerSuccess("Đã copy email admin");
    } catch {
      prompt("Email admin:", v);
    }
  };

  return (
    <div className="w-full max-w-[600px] mx-auto mt-8 mb-6">
      <div className="flex items-center mb-3 text-base-content flex-wrap gap-2">
        <HardDrive className="w-5 h-5 mr-1" />
        <h2 className="text-lg font-semibold">Google Drive (admin)</h2>
        <span className="badge badge-primary badge-sm gap-1">
          <Shield className="w-3 h-3" /> buiduchuy2010qn@gmail.com
        </span>
      </div>

      <div className="bg-base-200 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm text-base-content/80">
          <strong>1 Drive dùng chung cả web.</strong> Mọi user đăng ảnh/video
          backup vào folder này. Chỉ Gmail admin mới thấy mục này.
        </p>

        <div className="text-xs bg-base-300/60 rounded-xl p-3 space-y-1">
          <p className="font-semibold">Vào đâu trên app?</p>
          <p>
            Camera → <strong>Settings</strong> → cuộn xuống{" "}
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
                : "Backup Drive: chưa liên kết trên Render"}
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
            Liên kết Drive (Render — 1 lần)
          </p>
          <ol className="list-decimal pl-4 space-y-1.5">
            <li>
              Google Cloud → Service Account + bật <strong>Drive API</strong> →
              tải JSON key
            </li>
            <li>
              Env Render{" "}
              <code className="bg-base-300 px-1 rounded">
                GOOGLE_SERVICE_ACCOUNT_JSON
              </code>{" "}
              = nội dung file JSON
            </li>
            <li>
              Tạo folder Drive → Share <strong>Editor</strong> cho email service
              account
            </li>
            <li>
              Env{" "}
              <code className="bg-base-300 px-1 rounded">
                GOOGLE_DRIVE_FOLDER_ID
              </code>{" "}
              = ID folder (trên URL /folders/XXXX)
            </li>
            <li>
              (Tuỳ chọn) thêm admin khác:{" "}
              <code className="bg-base-300 px-1 rounded">
                ADMIN_EMAILS
              </code>
            </li>
          </ol>

          <div className="flex items-center gap-2 mt-2 p-2 bg-base-100 rounded-lg">
            <span className="text-[11px] opacity-70 shrink-0">Admin Gmail:</span>
            <code className="text-[11px] truncate flex-1">
              {email || "buiduchuy2010qn@gmail.com"}
            </code>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={copyEmail}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

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
