import { CONFIG } from "@/config";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  applyWebsiteUpdate,
  checkForAppUpdate,
  getCurrentBuildMeta,
  subscribeAppUpdate,
} from "@/utils/pwaUtils/updateWatcher";
import { SonnerInfo, SonnerSuccess } from "@/components/ui/SonnerToast";

export default function SwManager() {
  const [usage, setUsage] = useState(0);
  const [quota, setQuota] = useState(0);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { t } = useTranslation("auth");
  const build = getCurrentBuildMeta();

  const formatSize = (bytes) => {
    if (!bytes) return "0 KB";

    const kb = bytes / 1024;
    const mb = kb / 1024;

    if (mb >= 1) return mb.toFixed(2) + " MB";
    return kb.toFixed(2) + " KB";
  };

  const getStorageInfo = async () => {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      setUsage(estimate.usage || 0);
      setQuota(estimate.quota || 0);
    }
  };

  useEffect(() => {
    getStorageInfo();
    checkForAppUpdate();
    return subscribeAppUpdate((s) => setUpdateAvailable(Boolean(s?.available)));
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const has = await checkForAppUpdate();
      if (!has && !updateAvailable) {
        SonnerInfo(
          t("settings.sw_manager.alert_latest", {
            defaultValue: "Bạn đang dùng bản mới nhất",
          }),
        );
        setUpdating(false);
        return;
      }
      SonnerSuccess("Đang cập nhật…");
      await applyWebsiteUpdate();
    } catch {
      setUpdating(false);
      SonnerInfo("Cập nhật lỗi — thử lại");
    }
  };

  const handleUnregisterSW = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((r) => r.unregister());
        alert(t("settings.sw_manager.alert_unregistered"));
      });
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm(t("settings.sw_manager.confirm_clear"))) return;

    localStorage.clear();
    sessionStorage.clear();

    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }

    // clear indexeddb
    await clearIndexedDB();

    alert(t("settings.sw_manager.alert_cleared"));
    getStorageInfo();
  };

  const clearIndexedDB = async () => {
    if (!("indexedDB" in window)) return;

    const databases = await indexedDB.databases();

    await Promise.all(
      databases.map((db) => {
        return new Promise((resolve) => {
          const request = indexedDB.deleteDatabase(db.name);
          request.onsuccess = resolve;
          request.onerror = resolve;
          request.onblocked = resolve;
        });
      }),
    );
  };

  const percent = quota ? Math.round((usage / quota) * 100) : 0;

  return (
    <div className="flex-1 bg-base-100 rounded-lg p-5 shadow-sm flex flex-col gap-5">
      <h3 className="font-semibold text-lg text-center">
        {t("settings.sw_manager.title")}
      </h3>

      {/* VERSION */}
      <div className="text-sm text-base-content space-y-1">
        <p>
          {t("settings.sw_manager.client_version")}{" "}
          <span className="font-mono underline font-semibold">
            {CONFIG.app.clientVersion}
          </span>
        </p>
        <p>
          Build{" "}
          <span className="font-mono underline font-semibold">
            {build.buildId || "—"}
          </span>
        </p>
        <p>
          {t("settings.sw_manager.api_version")}{" "}
          <span className="font-mono underline font-semibold">
            {CONFIG.app.apiVersion}
          </span>
        </p>
        {updateAvailable ? (
          <p className="text-primary font-medium text-xs pt-1">
            Có bản mới — bấm nút bên dưới để cập nhật
          </p>
        ) : null}
      </div>

      {/* UPDATE — user taps only */}
      <button
        onClick={handleUpdate}
        className={`btn w-full ${updateAvailable ? "btn-primary" : "btn-outline"}`}
        type="button"
        disabled={updating}
      >
        {updating
          ? "Đang cập nhật…"
          : updateAvailable
            ? "Cập nhật ngay"
            : t("settings.sw_manager.update_btn")}
      </button>

      {/* STORAGE */}
      <div className="bg-base-200 rounded-lg p-4 text-sm space-y-2">
        <p className="font-medium">{t("settings.sw_manager.storage_title")}</p>

        <progress
          className="progress progress-primary w-full"
          value={usage}
          max={quota}
        ></progress>

        <p>
          {t("settings.sw_manager.used")}{" "}
          <span className="font-mono">{formatSize(usage)}</span>
        </p>
        <p>
          {t("settings.sw_manager.limit")}{" "}
          <span className="font-mono">{formatSize(quota)}</span>
        </p>
        <p className="text-xs opacity-70">
          {t("settings.sw_manager.percent", { percent })}
        </p>
      </div>

      <p className="text-sm text-warning">
        {t("settings.sw_manager.clear_warning")}
      </p>

      {/* CLEAR CACHE */}
      <button
        onClick={handleClearCache}
        className="btn btn-warning w-full"
        type="button"
      >
        {t("settings.sw_manager.clear_cache_btn")}
      </button>

      {/* ADVANCED */}
      <div className="border-t pt-4">
        <button
          onClick={handleUnregisterSW}
          className="btn btn-secondary w-full opacity-60 cursor-not-allowed"
          type="button"
          disabled
        >
          {t("settings.sw_manager.unregister_sw_btn")}
        </button>
      </div>
    </div>
  );
}
