import { useEffect, useState } from "react";
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
import { getMyLocalId } from "@/utils/auth/getMyLocalId";
import { SonnerError, SonnerSuccess } from "@/components/uikit/SonnerToast";
import { useAuthStore } from "@/stores";

function pickUserEmail(user) {
  return (
    user?.email ||
    user?.Email ||
    user?.mail ||
    localStorage.getItem("email") ||
    sessionStorage.getItem("email") ||
    ""
  );
}

/**
 * Kết nối Google Drive — CHỈ admin thấy UI.
 * User thường: backup ngầm nếu admin đã cấu hình (không hiện phần này).
 */
export default function GoogleDriveBackup() {
  const user = useAuthStore((s) => s.user);
  const localId = getMyLocalId(user);
  const email = pickUserEmail(user);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oauthStarting, setOauthStarting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() =>
    Boolean(user) &&
      isAdminUser(localId, { email, localId, uid: user?.uid || localId }),
  );

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [folderId, setFolderId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      // Không phải admin → không fetch / không hiện UI (user thường = null)
      const adminNow =
        Boolean(user) &&
        isAdminUser(localId, { email, localId, uid: user?.uid || localId });
      if (!adminNow) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const st = await fetchDriveServerStatus(true, localId, email);
      setStatus(st);
      // Không tin isAdmin từ server nếu client không match whitelist
      setIsAdmin(adminNow);
      if (st?.folderId) setFolderId(st.folderId);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localId, email]);

  // Chỉ admin
  if (!isAdmin) return null;

  const configured = Boolean(status?.configured);
  const enabled = status?.enabled !== false && configured;
  const neonOn = Boolean(status?.neon);
  const callbackUrl =
    status?.oauthCallbackUrl ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/api/drive-oauth-callback`
      : "https://huy-locket-production.up.railway.app/api/drive-oauth-callback");
  const adminHeaders = {
    "Content-Type": "application/json",
    "X-Local-Id": localId || "",
    "X-User-Email": email || "",
  };

  const saveAndLogin = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      if (!status?.hasOauthClient) {
        SonnerError("Cần OAuth Client ID + Secret từ Google Cloud");
        return;
      }
    }

    setSaving(true);
    setOauthStarting(true);
    try {
      // Folder ID tuỳ chọn — để trống server tự tạo "Huy Locket Web"
      const fid = folderId.trim() || "auto";
      const saveRes = await fetch("/api/drive-config", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          folderId: fid,
          clientId: clientId.trim() || undefined,
          clientSecret: clientSecret.trim() || undefined,
        }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saveData?.error || `Lưu lỗi ${saveRes.status}`);
      }

      const oRes = await fetch("/api/drive-oauth-start", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          folderId: folderId.trim() || "",
          clientId: clientId.trim() || undefined,
          clientSecret: clientSecret.trim() || undefined,
        }),
      });
      const oData = await oRes.json().catch(() => ({}));
      if (!oRes.ok || !oData?.url) {
        throw new Error(oData?.error || "Không tạo được link Google");
      }

      SonnerSuccess("Mở Google…", "Cho phép 1 lần — tự tạo folder nếu cần");
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
      className="w-full rounded-2xl border-2 border-success/40 bg-base-100 p-4 space-y-3"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <HardDrive className="w-5 h-5 text-success shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Auto backup Google Drive</p>
          <p className="text-xs opacity-60">
            Chụp xong → tự vào folder Ảnh / Video · Lưu bền (Neon)
          </p>
        </div>
        <span className="badge badge-ghost badge-sm gap-1">
          <Shield className="w-3 h-3" /> Admin
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : enabled ? (
          <Cloud className="w-4 h-4 text-success" />
        ) : (
          <CloudOff className="w-4 h-4 text-warning" />
        )}
        <span className={enabled ? "text-success" : "text-warning"}>
          {loading
            ? "Đang kiểm tra…"
            : enabled
              ? `✅ Auto backup BẬT${status?.source ? ` (${status.source})` : ""}`
              : "Chưa bật — làm 1 lần bên dưới"}
        </span>
      </div>

      {enabled && (
        <div className="alert alert-success text-xs py-2">
          <span>
            Đã bật. Chụp ảnh/video → tự backup. Cấu hình lưu Neon / env (không
            commit secret).
          </span>
        </div>
      )}

      {!enabled && !neonOn && (
        <div className="alert alert-warning text-xs py-2">
          <span>
            <strong>Neon chưa kết nối</strong> — Railway service <em>web</em>{" "}
            cần biến <code className="bg-base-300 px-1">DATABASE_URL</code>{" "}
            (Neon project <em>huy-locket-drive</em>). Token OAuth cũ vẫn nằm
            trong Neon; set env + redeploy là bật lại, không mất folder.
          </span>
        </div>
      )}

      {enabled && status?.folderUrl && (
        <a
          href={status.folderUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-success btn-sm gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Mở folder Drive
        </a>
      )}

      {!enabled && (
        <div className="rounded-xl bg-base-200 p-3 space-y-3 text-xs">
          <p className="font-semibold">Bật auto backup (an toàn — 1 lần)</p>
          <ol className="list-decimal pl-4 space-y-1 opacity-80">
            <li>
              Railway → service web → Variables → thêm{" "}
              <code className="bg-base-300 px-1">DATABASE_URL</code> từ Neon
              Console (Connection string, SSL). Redeploy.
            </li>
            <li>
              Google Cloud → OAuth client (Web) → Authorized redirect URI:{" "}
              <code className="bg-base-300 px-1 break-all">{callbackUrl}</code>
            </li>
            <li>
              Dán Client ID + Secret bên dưới (lấy từ Google Cloud —{" "}
              <strong>không</strong> commit lên Git)
            </li>
            <li>Bấm nút → Cho phép Google 1 lần</li>
          </ol>
          <label className="form-control w-full">
            <span className="label-text text-xs mb-1">OAuth Client ID</span>
            <input
              type="text"
              className="input input-bordered input-sm w-full font-mono"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="form-control w-full">
            <span className="label-text text-xs mb-1">OAuth Client Secret</span>
            <input
              type="password"
              className="input input-bordered input-sm w-full font-mono"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="form-control w-full">
            <span className="label-text text-xs mb-1">
              Folder ID (tuỳ chọn — để trống = tự tạo «Huy Locket Web»)
            </span>
            <input
              type="text"
              className="input input-bordered input-sm w-full font-mono"
              placeholder="Để trống cũng được"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-success btn-sm w-full gap-2"
            disabled={saving || oauthStarting}
            onClick={saveAndLogin}
          >
            {saving || oauthStarting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {oauthStarting
              ? "Đang mở Google…"
              : "Bật auto backup (OAuth 1 lần)"}
          </button>
        </div>
      )}

      <button type="button" className="btn btn-ghost btn-xs w-full" onClick={load}>
        Làm mới trạng thái
      </button>
    </div>
  );
}
