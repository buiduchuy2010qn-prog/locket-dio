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
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";

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
 * Admin card: dán JSON + Folder ID ngay trên web (không bắt buộc Render env).
 */
export default function GoogleDriveBackup({ forceShow = false }) {
  const { user, authTokens } = useContext(AuthContext);
  const localId = getMyLocalId(user, authTokens);
  const email = pickUserEmail(user, authTokens);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() =>
    isAdminUser(localId, { ...user, email, localId })
  );

  const [saJson, setSaJson] = useState("");
  const [folderId, setFolderId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const st = await fetchDriveServerStatus(true, localId, email);
      setStatus(st);
      setIsAdmin(
        Boolean(st?.isAdmin) ||
          isAdminUser(localId, { ...user, email, localId })
      );
      if (st?.folderId) setFolderId(st.folderId);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId, email]);

  if (!isAdmin && !forceShow) {
    return (
      <div
        id="google-drive-admin"
        className="w-full rounded-2xl border-2 border-dashed border-base-300 bg-base-200 p-4 text-sm text-base-content/70"
      >
        <p className="font-semibold text-base-content flex items-center gap-2">
          <HardDrive className="w-5 h-5" /> Google Drive (dùng chung web)
        </p>
        <p className="mt-2 text-xs">
          Chỉ admin{" "}
          <code className="bg-base-300 px-1 rounded">
            buiduchuy2010qn@gmail.com
          </code>{" "}
          cấu hình được. Login:{" "}
          <code className="bg-base-300 px-1 rounded">
            {email || "chưa có email"}
          </code>
        </p>
        <a className="link link-primary text-xs" href="/admin/google-drive">
          /admin/google-drive
        </a>
      </div>
    );
  }

  const configured = Boolean(status?.configured);
  const enabled = status?.enabled !== false && configured;

  const saveConfig = async () => {
    if (!saJson.trim() || !folderId.trim()) {
      SonnerError("Cần dán JSON + Folder ID");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/drive-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Local-Id": localId || "",
          "X-User-Email": email || "",
        },
        body: JSON.stringify({
          serviceAccountJson: saJson,
          folderId: folderId.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Lỗi ${res.status}`);
      }
      SonnerSuccess(
        "Đã liên kết Google Drive!",
        data?.message || data?.serviceEmail || ""
      );
      setSaJson(""); // xóa JSON khỏi form (đã lưu server)
      await load();
    } catch (e) {
      SonnerError(e?.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      id="google-drive-admin"
      className="w-full rounded-3xl border-4 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-950/40 dark:to-base-300 shadow-xl overflow-hidden"
    >
      <div className="bg-amber-400 text-amber-950 px-4 py-3 flex items-center gap-2 flex-wrap">
        <HardDrive className="w-6 h-6 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-black text-base sm:text-lg leading-tight">
            🔗 LIÊN KẾT GOOGLE DRIVE (ADMIN)
          </p>
          <p className="text-xs font-semibold opacity-90">
            Dán JSON + Folder ID ngay tại đây · 1 Drive cho cả web
          </p>
        </div>
        <span className="badge badge-neutral gap-1 text-xs">
          <Shield className="w-3 h-3" /> Admin
        </span>
      </div>

      <div className="p-4 sm:p-5 space-y-4 text-base-content">
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
                : "⚠️ CHƯA LIÊN KẾT — điền form bên dưới"}
          </span>
        </div>

        {enabled && status?.folderUrl && (
          <a
            href={status.folderUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-warning btn-sm gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Mở folder Google Drive
          </a>
        )}

        {status?.serviceEmail && (
          <p className="text-xs text-success break-all">
            Service Account: {status.serviceEmail}
            {status.source ? ` (nguồn: ${status.source})` : ""}
          </p>
        )}

        {/* Form dán — admin tự liên kết, không cần Render env */}
        <div className="rounded-2xl bg-base-100 border-2 border-amber-300 p-4 space-y-3">
          <p className="font-bold text-amber-800 dark:text-amber-200">
            📝 Dán thông tin để liên kết (1 lần)
          </p>

          <div className="text-xs space-y-1 opacity-80 bg-base-200 rounded-xl p-3">
            <p className="font-semibold">Làm trên Google (≈ 3 phút):</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                Vào{" "}
                <a
                  className="link link-primary"
                  href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Cloud → Service Accounts
                </a>
              </li>
              <li>
                Tạo Service Account → tab <strong>Keys</strong> → Add key →{" "}
                <strong>JSON</strong> (tải file .json)
              </li>
              <li>
                Bật{" "}
                <a
                  className="link link-primary"
                  href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Drive API
                </a>
              </li>
              <li>
                Drive.google.com → tạo folder (vd. <em>Locket Dio Web</em>) →
                Share → dán email trong JSON (
                <code>client_email</code>) quyền <strong>Editor</strong>
              </li>
              <li>
                Copy Folder ID từ URL:{" "}
                <code className="bg-base-300 px-1">
                  drive.google.com/.../folders/<b>XXXX</b>
                </code>
              </li>
            </ol>
          </div>

          <label className="form-control w-full">
            <span className="label-text text-xs font-semibold mb-1">
              1) Dán nội dung file JSON Service Account
            </span>
            <textarea
              className="textarea textarea-bordered w-full font-mono text-[11px] min-h-[120px]"
              placeholder='{"type":"service_account","project_id":"...","private_key":"-----BEGIN...","client_email":"...@....iam.gserviceaccount.com",...}'
              value={saJson}
              onChange={(e) => setSaJson(e.target.value)}
            />
          </label>

          <label className="form-control w-full">
            <span className="label-text text-xs font-semibold mb-1">
              2) Folder ID (hoặc dán cả link folder)
            </span>
            <input
              type="text"
              className="input input-bordered w-full font-mono text-sm"
              placeholder="1a2B3cDeFgHiJkLmNoPqRsTuVwXyZ"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="btn btn-primary w-full gap-2"
            disabled={saving || !saJson.trim() || !folderId.trim()}
            onClick={saveConfig}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <HardDrive className="w-4 h-4" />
            )}
            {saving ? "Đang lưu…" : "Lưu & bật backup Drive"}
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm w-full"
            onClick={load}
          >
            Kiểm tra lại trạng thái
          </button>
        </div>

        <p className="text-[11px] opacity-60">
          Gmail admin: {email || "buiduchuy2010qn@gmail.com"} · Sau khi bật,
          mọi bài đăng web backup vào folder đó.
        </p>
      </div>
    </div>
  );
}
