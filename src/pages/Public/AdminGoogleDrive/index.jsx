import GoogleDriveBackup from "@/pages/Public/Settings/GoogleDriveBackup";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * /admin/google-drive — tuỳ chọn, không bắt buộc
 */
export default function AdminGoogleDrivePage() {
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
            Tuỳ chọn · Không bắt buộc · Web vẫn dùng bình thường khi tắt
          </p>
        </div>

        <GoogleDriveBackup forceShow />
      </div>
    </div>
  );
}
