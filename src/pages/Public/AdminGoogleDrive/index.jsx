import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import GoogleDriveBackup from "@/pages/Public/Settings/GoogleDriveBackup";
import { useAuthStore } from "@/stores";
import { isAdminUser } from "@/utils/googleDrive";
import { getMyLocalId } from "@/utils/auth/getMyLocalId";

/** /admin/google-drive — chỉ admin */
export default function AdminGoogleDrivePage() {
  const user = useAuthStore((s) => s.user);
  const localId = getMyLocalId(user);
  const email =
    user?.email ||
    localStorage.getItem("email") ||
    sessionStorage.getItem("email") ||
    "";

  const isAdmin = useMemo(
    () =>
      Boolean(user) &&
      isAdminUser(localId, { email, localId, uid: user?.uid || localId }),
    [localId, email, user],
  );

  // User thường / chưa login → đá về home, không lộ trang Drive
  if (!user || !isAdmin) {
    return <Navigate to="/locket" replace />;
  }

  return (
    <div className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Link to="/settings" className="btn btn-ghost btn-sm gap-1 -ml-2">
          <ArrowLeft className="w-4 h-4" /> Quay lại Cài đặt
        </Link>

        <div className="text-center mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-base-content">
            Google Drive backup
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Chỉ admin · Liên kết 1 lần · Backup chung cho Huy Locket
          </p>
        </div>

        <GoogleDriveBackup />
      </div>
    </div>
  );
}
