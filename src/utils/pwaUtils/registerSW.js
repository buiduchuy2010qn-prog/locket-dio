import { registerSW } from "virtual:pwa-register";
import {
  handleServiceWorkerUpdate,
  setPendingSwApply,
  checkForAppUpdate,
} from "./updateWatcher";

/**
 * PWA register — user-prompted update via toast (updateWatcher).
 * No auto-reload. No spam (SW waiting toast once per session).
 */
export function initPWA() {
  let registration = null;
  let swUpdateNotified = false;

  const notifySwOnce = (updateSW) => {
    if (swUpdateNotified) return;
    swUpdateNotified = true;
    handleServiceWorkerUpdate(() => updateSW?.(true));
  };

  const updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      console.log("[PWA] waiting SW — show update toast once");
      notifySwOnce(updateSW);
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
        notifySwOnce(updateSW);
      }

      // SW update probe every 10 min (version.json poll is separate)
      setInterval(() => {
        if (document.hidden || !registration) return;
        try {
          registration.update();
        } catch {
          /* ignore */
        }
      }, 10 * 60 * 1000);
    },
  });

  // visibility: quiet version check only (cooldown inside updateWatcher)
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
