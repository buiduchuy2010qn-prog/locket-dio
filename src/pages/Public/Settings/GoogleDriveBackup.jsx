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
 * Card admin — 1 Google Drive dùng chung cả web.
 * Chỉ admin (buiduchuy2010qn@gmail.com) thấy.
 */
export default function GoogleDriveBackup({ forceShow = false }) {
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

  if (!isAdmin && !forceShow) {
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
    <div
      id="google-drive-admin"
      className="w-full rounded-3xl border-4 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/40 dark:to-base-300 shadow-xl overflow-hidden"
    >
      {/* Banner nhận diện */}
      <div className="bg-amber-400 text-amber-950 px-4 py-3 flex items-center gap-2 flex-wrap">
        <HardDrive className="w-6 h-6 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-black text-base sm:text-lg leading-tight">
            🔗 LIÊN KẾT GOOGLE DRIVE (ADMIN)
          </p>
          <p className="text-xs font-semibold opacity-90">
            1 Drive dùng chung cả website · chỉ admin thấy
          </p>
        </div>
        <span className="badge badge-neutral gap-1 text-xs">
          <Shield className="w-3 h-3" /> Admin
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-3 text-base-content">
        <p className="text-sm">
          Mọi ảnh/video user đăng trên web sẽ backup vào{" "}
          <strong>folder Drive chung</strong> (không cần từng user login
          Google).
        </p>

        <div className="flex items-center gap-2 text-sm font-semibold">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : enabled ? (
            <Cloud className="w-5 h-5 text-success" />
          ) : (
            <CloudOff className="w-5 h-5 text-warning" />
          )}
          <span>
            {loading
              ? "Đang kiểm tra…"
              : enabled
                ? "✅ Backup Drive: ĐANG BẬT"
                : "⚠️ Backup Drive: CHƯA LIÊN KẾT (cấu hình Render)"}
          </span>
        </div>

        {enabled && status?.folderUrl && (
          <a
            href={status.folderUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-warning btn-sm gap-2 w-full sm:w-auto"
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

        <div className="rounded-2xl bg-base-100/80 border border-amber-300/50 p-3 space-y-2 text-xs">
          <p className="font-bold text-sm text-amber-800 dark:text-amber-200">
            Cách liên kết (1 lần trên Render)
          </p>
          <ol className="list-decimal pl-4 space-y-1.5">
            <li>
              Google Cloud → tạo <strong>Service Account</strong> → bật{" "}
              <strong>Drive API</strong> → tải JSON
            </li>
            <li>
              Env{" "}
              <code className="bg-base-300 px-1 rounded">
                GOOGLE_SERVICE_ACCOUNT_JSON
              </code>{" "}
              = nội dung file JSON
            </li>
            <li>
              Drive: tạo folder → Share <strong>Editor</strong> cho email
              service account
            </li>
            <li>
              Env{" "}
              <code className="bg-base-300 px-1 rounded">
                GOOGLE_DRIVE_FOLDER_ID
              </code>{" "}
              = ID trong URL{" "}
              <code className="bg-base-300 px-1 rounded">/folders/XXXX</code>
            </li>
          </ol>

          <div className="flex items-center gap-2 p-2 bg-base-200 rounded-lg">
            <span className="opacity-70 shrink-0">Gmail admin:</span>
            <code className="truncate flex-1">
              {email || "buiduchuy2010qn@gmail.com"}
            </code>
            <button type="button" className="btn btn-ghost btn-xs" onClick={copyEmail}>
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-primary w-full"
            onClick={load}
          >
            Kiểm tra liên kết lại
          </button>
        </div>

        <p className="text-[11px] opacity-60">
          Menu: <strong>Google Drive (Admin)</strong> · hoặc trang{" "}
          <strong>/settings</strong> · hoặc{" "}
          <strong>/admin/google-drive</strong>
        </p>
      </div>
    </div>
  );
}
