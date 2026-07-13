import { registerSW } from "virtual:pwa-register";
import {
  handleServiceWorkerUpdate,
  setPendingSwApply,
  checkForAppUpdate,
} from "./updateWatcher";

/**
 * PWA register — user-prompted update via glass toast (updateWatcher).
 * No auto-reload. No spam.
 */
export function initPWA() {
  let registration = null;

  const updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      console.log("[PWA] waiting SW — show update toast");
      handleServiceWorkerUpdate(() => updateSW?.(true));
    },
    onOfflineReady() {
      console.log("[PWA] offline ready");
    },
    onRegisteredSW(_url, reg) {
      registration = reg || null;
      if (!registration) return;

      setPendingSwApply(async () => {
        let done = false;
        const reload = () => {
          if (done) return;
          done = true;
          window.location.reload();
        };
        navigator.serviceWorker?.addEventListener?.("controllerchange", reload);
        await updateSW?.(true);
        setTimeout(reload, 2000);
      });

      if (registration.waiting) {
        handleServiceWorkerUpdate(() => updateSW?.(true));
      }

      // SW update probe every 2 min while page visible (version.json is more frequent)
      setInterval(() => {
        if (document.hidden || !registration) return;
        try {
          registration.update();
        } catch {
          /* ignore */
        }
      }, 2 * 60 * 1000);
    },
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !registration) return;
    try {
      registration.update();
    } catch {
      /* ignore */
    }
    checkForAppUpdate({ forceToast: true });
  });

  return updateSW;
}
