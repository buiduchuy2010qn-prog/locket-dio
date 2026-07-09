import { useContext, useEffect, useState } from "react";
import {
  Cloud,
  CloudOff,
  ExternalLink,
  HardDrive,
  Loader2,
  LogIn,
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
 * Admin: liên kết Drive bằng OAuth (Drive cá nhân Gmail).
 * Service Account không ghi được My Drive (quota 0) — không dùng nữa cho backup.
 */
export default function GoogleDriveBackup({ forceShow = false }) {
  const { user, authTokens } = useContext(AuthContext);
  const localId = getMyLocalId(user, authTokens);
  const email = pickUserEmail(user, authTokens);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oauthStarting, setOauthStarting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() =>
    isAdminUser(localId, { ...user, email, localId })
  );

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
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
  const adminHeaders = {
    "Content-Type": "application/json",
    "X-Local-Id": localId || "",
    "X-User-Email": email || "",
  };

  const saveAndLogin = async () => {
    if (!folderId.trim()) {
      SonnerError("Cần Folder ID (từ URL folder Drive)");
      return;
    }
    if (!clientId.trim() || !clientSecret.trim()) {
      // Cho phép chỉ login nếu server đã có client
      if (!status?.hasOauthClient) {
        SonnerError("Cần OAuth Client ID + Secret");
        return;
      }
    }

    setSaving(true);
    setOauthStarting(true);
    try {
      // 1) Lưu client + folder
      const saveRes = await fetch("/api/drive-config", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          folderId: folderId.trim(),
          clientId: clientId.trim() || undefined,
          clientSecret: clientSecret.trim() || undefined,
        }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saveData?.error || `Lưu lỗi ${saveRes.status}`);
      }

      // 2) Lấy URL Google OAuth
      const oRes = await fetch("/api/drive-oauth-start", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          folderId: folderId.trim(),
          clientId: clientId.trim() || undefined,
          clientSecret: clientSecret.trim() || undefined,
        }),
      });
      const oData = await oRes.json().catch(() => ({}));
      if (!oRes.ok || !oData?.url) {
        throw new Error(oData?.error || "Không tạo được link đăng nhập Google");
      }

      SonnerSuccess("Chuyển sang Google…", "Cấp quyền Drive rồi quay lại");
      window.location.href = oData.url;
    } catch (e) {
      SonnerError(e?.message || "Thất bại");
      setOauthStarting(false);
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
            Đăng nhập Google (OAuth) · 1 folder cho cả web
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
                ? "✅ Backup Drive: ĐANG BẬT (OAuth)"
                : "⚠️ CHƯA SẴN SÀNG — đăng nhập Google bên dưới"}
          </span>
        </div>

        {status?.warning && (
          <div className="alert alert-warning text-xs py-2">
            <span>{status.warning}</span>
          </div>
        )}

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

        {status?.oauthEmail && (
          <p className="text-xs text-success break-all">
            Google: {status.oauthEmail}
            {status.authMode ? ` · mode: ${status.authMode}` : ""}
          </p>
        )}

        <div className="rounded-2xl bg-base-100 border-2 border-amber-300 p-4 space-y-3">
          <p className="font-bold text-amber-800 dark:text-amber-200">
            📝 Liên kết bằng tài khoản Google của bạn
          </p>

          <div className="text-xs space-y-1 opacity-90 bg-base-200 rounded-xl p-3">
            <p className="font-semibold text-error">
              Vì sao folder trống? Service Account không ghi được Drive Gmail
              cá nhân (Google chặn quota). Cần OAuth 1 lần.
            </p>
            <p className="font-semibold mt-2">Làm trên Google Cloud (~2 phút):</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>
                Mở{" "}
                <a
                  className="link link-primary"
                  href="https://console.cloud.google.com/apis/credentials?project=phrasal-fire-465215-n5"
                  target="_blank"
                  rel="noreferrer"
                >
                  APIs &amp; Services → Credentials
                </a>
              </li>
              <li>
                <strong>Create Credentials</strong> →{" "}
                <strong>OAuth client ID</strong> → Application type:{" "}
                <strong>Web application</strong>
              </li>
              <li>
                Name: <code>locket-dio-web</code>
              </li>
              <li>
                <strong>Authorized redirect URIs</strong> → Add:{" "}
                <code className="bg-base-300 px-1 break-all">
                  https://huy-locket.onrender.com/api/drive-oauth-callback
                </code>
              </li>
              <li>
                Create → copy <strong>Client ID</strong> +{" "}
                <strong>Client Secret</strong>
              </li>
              <li>
                (Lần đầu) OAuth consent screen: External → thêm test user{" "}
                <code>buiduchuy2010qn@gmail.com</code>
              </li>
              <li>
                Folder ID từ URL folder <em>Locket Dio Web</em>: phần sau{" "}
                <code>/folders/</code>
              </li>
            </ol>
          </div>

          <label className="form-control w-full">
            <span className="label-text text-xs font-semibold mb-1">
              1) OAuth Client ID
            </span>
            <input
              type="text"
              className="input input-bordered w-full font-mono text-xs"
              placeholder="xxxx.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="form-control w-full">
            <span className="label-text text-xs font-semibold mb-1">
              2) OAuth Client Secret
            </span>
            <input
              type="password"
              className="input input-bordered w-full font-mono text-xs"
              placeholder="GOCSPX-..."
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              autoComplete="off"
            />
          </label>

          <label className="form-control w-full">
            <span className="label-text text-xs font-semibold mb-1">
              3) Folder ID (hoặc dán cả link folder)
            </span>
            <input
              type="text"
              className="input input-bordered w-full font-mono text-sm"
              placeholder="15u_rammosTOF7msvt0D1SoHklcCiZzt"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            />
          </label>

          <button
            type="button"
            className="btn btn-primary w-full gap-2"
            disabled={saving || oauthStarting || !folderId.trim()}
            onClick={saveAndLogin}
          >
            {saving || oauthStarting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {oauthStarting
              ? "Đang mở Google…"
              : "Lưu & Đăng nhập Google (bật backup)"}
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
          Gmail admin: {email || "buiduchuy2010qn@gmail.com"} · Sau khi OAuth
          xong, mỗi bài đăng web sẽ có file trong folder Drive. Folder ID của
          bạn:{" "}
          <code className="bg-base-300 px-1">
            15u_rammosTOF7msvt0D1SoHklcCiZzt
          </code>
        </p>
      </div>
    </div>
  );
}
