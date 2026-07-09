import { useEffect, useState } from "react";
import { Cloud, CloudOff, HardDrive, Loader2, Link2 } from "lucide-react";
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  getDriveEmail,
  getGoogleClientId,
  isDriveAutoBackupEnabled,
  isDriveConfigured,
  isDriveConnected,
  setDriveAutoBackupEnabled,
} from "@/utils/googleDrive";
import { SonnerError, SonnerSuccess } from "@/components/ui/SonnerToast";

/**
 * Kết nối Google Drive + bật/tắt auto-backup mỗi lần đăng.
 */
export default function GoogleDriveBackup() {
  const [connected, setConnected] = useState(false);
  const [auto, setAuto] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [clientIdDraft, setClientIdDraft] = useState("");
  const [configured, setConfigured] = useState(false);

  const refresh = () => {
    setConfigured(isDriveConfigured());
    setConnected(isDriveConnected());
    setAuto(isDriveAutoBackupEnabled());
    setEmail(getDriveEmail());
    setClientIdDraft(getGoogleClientId());
  };

  useEffect(() => {
    refresh();
  }, []);

  const saveClientId = () => {
    const id = clientIdDraft.trim();
    if (!id) {
      SonnerError("Nhập Google OAuth Client ID");
      return;
    }
    localStorage.setItem("VITE_GOOGLE_CLIENT_ID", id);
    setConfigured(true);
    SonnerSuccess("Đã lưu Client ID", "Tiếp theo: bấm Kết nối Google Drive");
  };

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connectGoogleDrive({ prompt: "consent" });
      refresh();
      SonnerSuccess(
        "Đã kết nối Google Drive",
        "Mỗi lần đăng sẽ backup vào folder “Locket Dio”"
      );
    } catch (err) {
      SonnerError(err?.message || "Kết nối Drive thất bại");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    setDriveAutoBackupEnabled(false);
    refresh();
    SonnerSuccess("Đã ngắt Google Drive");
  };

  const toggleAuto = () => {
    if (!connected) {
      SonnerError("Hãy kết nối Google Drive trước");
      return;
    }
    const next = !auto;
    setDriveAutoBackupEnabled(next);
    setAuto(next);
    SonnerSuccess(
      next ? "Đã bật backup Drive" : "Đã tắt backup Drive",
      next
        ? "Ảnh/video sẽ lưu folder Locket Dio (không phụ thuộc laptop)"
        : "Chỉ đăng Locket, không copy Drive"
    );
  };

  return (
    <div className="w-full max-w-[600px] mx-auto mt-8 mb-6">
      <div className="flex items-center mb-3 text-base-content">
        <HardDrive className="w-5 h-5 mr-2" />
        <h2 className="text-lg font-semibold">Google Drive backup</h2>
      </div>

      <div className="bg-base-200 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm text-base-content/80">
          Ảnh đăng Locket đã nằm trên cloud (R2). Bật thêm backup Drive để có bản
          riêng trên Google Drive — tắt laptop cũng không mất.
        </p>

        {!configured && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-base-content/70">
              Google OAuth Client ID (Web)
            </label>
            <input
              type="text"
              value={clientIdDraft}
              onChange={(e) => setClientIdDraft(e.target.value)}
              placeholder="xxxxx.apps.googleusercontent.com"
              className="input input-bordered w-full text-sm"
            />
            <button
              type="button"
              className="btn btn-sm btn-primary w-full"
              onClick={saveClientId}
            >
              Lưu Client ID
            </button>
            <p className="text-xs text-base-content/60 leading-relaxed">
              Tạo tại{" "}
              <a
                className="link link-primary"
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
              >
                Google Cloud Console
              </a>
              : bật Drive API → OAuth Client (Web) → Authorized JavaScript
              origins thêm{" "}
              <code className="text-[10px]">https://huy-locket.onrender.com</code>{" "}
              và{" "}
              <code className="text-[10px]">http://localhost:5173</code>.
            </p>
          </div>
        )}

        {configured && (
          <>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                {connected ? (
                  <Cloud className="w-4 h-4 text-success" />
                ) : (
                  <CloudOff className="w-4 h-4 text-warning" />
                )}
                {connected
                  ? `Đã kết nối${email ? `: ${email}` : ""}`
                  : "Chưa kết nối Drive"}
              </span>
              {connected ? (
                <button
                  type="button"
                  className="btn btn-xs btn-ghost"
                  onClick={handleDisconnect}
                  disabled={busy}
                >
                  Ngắt
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-xs btn-primary"
                  onClick={handleConnect}
                  disabled={busy}
                >
                  {busy ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Link2 className="w-3 h-3" />
                  )}
                  Kết nối
                </button>
              )}
            </div>

            <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
              <span className="text-sm font-medium">
                Tự động backup mỗi lần đăng
              </span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={auto && connected}
                onChange={toggleAuto}
                disabled={!connected}
              />
            </label>

            {connected && auto && (
              <p className="text-xs text-success">
                ✓ Mỗi bài đăng sẽ copy vào folder Drive “Locket Dio”
              </p>
            )}

            {configured && (
              <button
                type="button"
                className="btn btn-xs btn-ghost opacity-60"
                onClick={() => {
                  localStorage.removeItem("VITE_GOOGLE_CLIENT_ID");
                  disconnectGoogleDrive();
                  setDriveAutoBackupEnabled(false);
                  refresh();
                }}
              >
                Đổi Client ID
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
