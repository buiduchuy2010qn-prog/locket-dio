import GoogleDriveBackup from "@/pages/Public/Settings/GoogleDriveBackup";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Trang riêng: /admin/google-drive
 * Dễ nhận biết — chỉ admin thấy card liên kết.
 */
export default function AdminGoogleDrivePage() {
  return (
    <div className="min-h-screen bg-base-200 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          to="/settings"
          className="btn btn-ghost btn-sm gap-1 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Cài đặt
        </Link>

        <div className="text-center mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-base-content">
            Liên kết Google Drive
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Trang admin · 1 Drive cho cả website
          </p>
        </div>

        <GoogleDriveBackup />
      </div>
    </div>
  );
}
