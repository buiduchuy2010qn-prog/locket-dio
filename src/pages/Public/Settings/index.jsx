import React, { Suspense, lazy } from "react";
import GoogleDriveBackup from "./GoogleDriveBackup";

const ThemeSelector = lazy(() => import("@/components/Theme/ThemeSelector"));
const SettingsExtras = lazy(() => import("./SettingsExtras"));
const CameraFrameSelector = lazy(() => import("./CameraFrameSelector"));

export default function Settings() {
  return (
    <div className="w-full min-h-screen bg-base-200 py-6 px-4 sm:px-6 lg:px-8 flex justify-center">
      <div className="w-full max-w-7xl space-y-6">
        <h1 className="text-4xl font-lovehouse font-semibold text-base-content mb-2 text-center">
          Setting Huy Locket
        </h1>

        {/* ADMIN: Google Drive — full width, nổi bật trên cùng */}
        <section aria-label="Google Drive Admin">
          <GoogleDriveBackup />
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Suspense
            fallback={
              <div className="bg-base-300 rounded-2xl shadow-md p-4 h-[200px] flex items-center justify-center">
                <span className="loading loading-spinner text-primary"></span>
              </div>
            }
          >
            <div className="bg-base-300 rounded-2xl shadow-md p-4 h-full flex flex-col">
              <ThemeSelector />
            </div>
          </Suspense>

          <Suspense
            fallback={
              <div className="bg-base-300 rounded-2xl shadow-md p-4 h-[200px] flex items-center justify-center">
                <span className="loading loading-spinner text-primary"></span>
              </div>
            }
          >
            <div className="bg-base-300 rounded-2xl shadow-md p-4 h-full flex flex-col">
              <CameraFrameSelector />
            </div>
          </Suspense>

          <Suspense
            fallback={
              <div className="bg-base-300 rounded-2xl shadow-md p-4 h-[200px] flex items-center justify-center">
                <span className="loading loading-spinner text-primary"></span>
              </div>
            }
          >
            <div className="bg-base-300 rounded-2xl shadow-md p-4 h-full flex flex-col">
              <SettingsExtras />
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
