import { registerSW } from "virtual:pwa-register";
import {
  handleServiceWorkerUpdate,
  setPendingSwApply,
  checkForAppUpdate,
} from "./updateWatcher";

/**
 * PWA register — silent. AppUpdateButton appears when update is ready.
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
    // Register as soon as module runs (do not wait for window load only).
    // Scope is `/` via vite-plugin-pwa + Workbox(`/sw.js`, { scope: "/" }).
    immediate: true,
    onNeedRefresh() {
      console.log("[PWA] waiting SW — show update button");
      notifySwOnce(updateSW);
    },
    onOfflineReady() {
      console.log("[PWA] offline ready — shell cached");
    },
    onRegisteredSW(swUrl, reg) {
      console.log("[PWA] registered", swUrl, "scope", reg?.scope);
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

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !registration) return;
    try {
      registration.update();
    } catch {
      /* ignore */
    }
    checkForAppUpdate();
  });

  return updateSW;
}
