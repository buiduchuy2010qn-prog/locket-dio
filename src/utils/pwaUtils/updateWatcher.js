/**
 * Ultra-sensitive website update detector.
 * Polls /version.json (no-store), SW waiting, focus/online/visibility.
 * Toast is fixed top/bottom — never near caption / camera controls.
 */

import currentBuild from "@/config/buildMeta.json";

const TOAST_ID = "app-update-toast";
const STYLE_ID = "app-update-toast-style";
const STORAGE_BUILD = "app_known_build_id";
const STORAGE_DISMISS = "app_update_dismissed_build";
const STORAGE_RELOAD_GUARD = "app_update_reload_guard";
const POLL_MS = 20 * 1000; // 20s while active
const DISMISS_MS = 6 * 60 * 60 * 1000; // 6h "Để sau" per buildId

let pollTimer = null;
let started = false;
let checking = false;
let lastToastBuildId = null;
/** @type {null | (() => void | Promise<void>)} */
let pendingSwApply = null;

function now() {
  return Date.now();
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getCurrentBuildMeta() {
  return {
    version: currentBuild?.version || "0.0.0",
    buildId: currentBuild?.buildId || "unknown",
    commitHash: currentBuild?.commitHash || "",
    deployedAt: currentBuild?.deployedAt || "",
  };
}

/**
 * Fetch /version.json with cache bust (required API).
 */
export async function fetchLatestVersion() {
  const url = `/version.json?t=${Date.now()}`;
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    },
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`version.json ${res.status}`);
  const data = await res.json();
  if (!data?.buildId) throw new Error("version.json missing buildId");
  return {
    version: String(data.version || ""),
    buildId: String(data.buildId),
    commitHash: String(data.commitHash || ""),
    deployedAt: String(data.deployedAt || ""),
  };
}

function isDismissedForBuild(buildId) {
  const dismissed = safeGet(STORAGE_DISMISS);
  if (!dismissed) return false;
  try {
    const { buildId: b, at } = JSON.parse(dismissed);
    if (b !== buildId) return false;
    return now() - Number(at || 0) < DISMISS_MS;
  } catch {
    return false;
  }
}

function markDismissed(buildId) {
  safeSet(
    STORAGE_DISMISS,
    JSON.stringify({ buildId, at: now() }),
  );
  lastToastBuildId = buildId;
}

function removeUpdateToast() {
  document.getElementById(TOAST_ID)?.remove();
}

/**
 * Glassmorphism update toast (required API).
 * PC: top-right · Mobile: bottom-safe — never near caption.
 */
export function showUpdateAvailableToast({
  latest,
  onUpdate,
  onLater,
} = {}) {
  const buildId = latest?.buildId || "unknown";
  if (document.getElementById(TOAST_ID)) return;
  if (isDismissedForBuild(buildId)) return;
  if (lastToastBuildId === buildId && document.getElementById(TOAST_ID)) return;

  lastToastBuildId = buildId;

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes appUpdateIn {
        from { opacity: 0; transform: translateY(-8px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      #${TOAST_ID} {
        position: fixed;
        z-index: 999980;
        max-width: min(360px, calc(100vw - 24px));
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(28, 22, 36, 0.82);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow: 0 8px 28px rgba(0,0,0,0.28);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        font-family: system-ui, -apple-system, sans-serif;
        animation: appUpdateIn 0.28s ease-out;
        pointer-events: auto;
      }
      @media (max-width: 768px) {
        #${TOAST_ID} {
          left: 50%;
          right: auto;
          top: auto;
          bottom: max(16px, env(safe-area-inset-bottom));
          transform: translateX(-50%);
        }
      }
      @media (min-width: 769px) {
        #${TOAST_ID} {
          top: max(16px, env(safe-area-inset-top));
          right: 16px;
          left: auto;
          bottom: auto;
        }
      }
      #${TOAST_ID} .app-update-msg {
        margin: 0 0 10px;
        font-size: 13px;
        line-height: 1.4;
        font-weight: 500;
        color: rgba(255,255,255,0.95);
      }
      #${TOAST_ID} .app-update-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      #${TOAST_ID} button {
        border: none;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        border-radius: 999px;
        padding: 7px 12px;
        line-height: 1.2;
      }
      #${TOAST_ID} .app-update-now {
        background: linear-gradient(135deg, #f9a8d4, #e879f9);
        color: #1a1020;
      }
      #${TOAST_ID} .app-update-later {
        background: rgba(255,255,255,0.12);
        color: rgba(255,255,255,0.85);
      }
      #${TOAST_ID} button:disabled {
        opacity: 0.6;
        cursor: wait;
      }
    `;
    document.head.appendChild(style);
  }

  const aside = document.createElement("aside");
  aside.id = TOAST_ID;
  aside.setAttribute("role", "status");
  aside.setAttribute("aria-live", "polite");
  aside.setAttribute("aria-label", "Có bản cập nhật mới");
  aside.setAttribute("data-update-toast", "true");

  const msg = document.createElement("p");
  msg.className = "app-update-msg";
  msg.textContent = "Đã có bản cập nhật mới. Bấm để tải lại.";

  const actions = document.createElement("div");
  actions.className = "app-update-actions";

  const btnLater = document.createElement("button");
  btnLater.type = "button";
  btnLater.className = "app-update-later";
  btnLater.textContent = "Để sau";

  const btnNow = document.createElement("button");
  btnNow.type = "button";
  btnNow.className = "app-update-now";
  btnNow.textContent = "Cập nhật ngay";

  btnLater.onclick = () => {
    markDismissed(buildId);
    removeUpdateToast();
    onLater?.();
  };

  btnNow.onclick = async () => {
    btnNow.disabled = true;
    btnLater.disabled = true;
    btnNow.textContent = "Đang cập nhật…";
    try {
      await (onUpdate?.() ?? applyWebsiteUpdate());
    } catch (e) {
      console.error("[update] apply failed", e);
      btnNow.disabled = false;
      btnLater.disabled = false;
      btnNow.textContent = "Cập nhật ngay";
    }
  };

  actions.appendChild(btnLater);
  actions.appendChild(btnNow);
  aside.appendChild(msg);
  aside.appendChild(actions);
  document.body.appendChild(aside);
}

/**
 * Clear Cache API + optional SW unregister (required API).
 */
export async function clearOldAppCache() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.warn("[update] clear caches", e);
  }
}

/**
 * Apply update safely — no infinite reload loop (required API).
 */
export async function applyWebsiteUpdate() {
  const guard = safeGet(STORAGE_RELOAD_GUARD);
  if (guard) {
    try {
      const { at } = JSON.parse(guard);
      // Block rapid reloads within 8s
      if (now() - Number(at || 0) < 8000) {
        console.warn("[update] reload guard active — skip");
        return;
      }
    } catch {
      /* continue */
    }
  }

  safeSet(
    STORAGE_RELOAD_GUARD,
    JSON.stringify({ at: now() }),
  );

  // Remember we are applying so next load won't re-spam same cycle
  const current = getCurrentBuildMeta();
  safeSet(STORAGE_BUILD, current.buildId);

  await clearOldAppCache();

  // Prefer SW skipWaiting path if registered
  if (typeof pendingSwApply === "function") {
    try {
      await pendingSwApply();
      return;
    } catch (e) {
      console.warn("[update] SW apply failed, hard reload", e);
    }
  }

  // Hard reload with cache-bypass hint
  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now()));
  window.location.replace(url.toString());
}

/**
 * Compare remote vs local buildId (required API).
 * @returns {Promise<boolean>} true if update available
 */
export async function checkForAppUpdate({ forceToast = true } = {}) {
  if (checking) return false;
  // Never poll-spam while tab hidden (start/focus may force)
  if (typeof document !== "undefined" && document.hidden) {
    return false;
  }

  checking = true;
  try {
    const latest = await fetchLatestVersion();
    const current = getCurrentBuildMeta();

    // Already on latest deployed build
    if (latest.buildId === current.buildId) {
      safeSet(STORAGE_BUILD, latest.buildId);
      safeRemove(STORAGE_RELOAD_GUARD);
      return false;
    }

    // Remote buildId differs from embedded → new deploy available
    if (!latest.buildId || isDismissedForBuild(latest.buildId)) {
      return false;
    }

    // Prevent toast spam for same buildId already shown this session
    if (lastToastBuildId === latest.buildId && document.getElementById(TOAST_ID)) {
      return true;
    }

    if (forceToast !== false) {
      showUpdateAvailableToast({
        latest,
        onUpdate: () => applyWebsiteUpdate(),
        onLater: () => markDismissed(latest.buildId),
      });
    }
    return true;
  } catch (e) {
    if (import.meta.env?.DEV) {
      console.debug("[update] check skipped", e?.message || e);
    }
    return false;
  } finally {
    checking = false;
  }
}

export function handleVisibilityUpdateCheck() {
  if (document.visibilityState !== "visible") {
    stopUpdateWatcher({ keepListeners: true });
    return;
  }
  // Resume poll + immediate check
  if (started) {
    ensurePoll();
  }
  checkForAppUpdate({ forceToast: true });
  // Also poke SW
  try {
    navigator.serviceWorker?.getRegistration?.().then((reg) => {
      reg?.update?.();
    });
  } catch {
    /* ignore */
  }
}

export function handleOnlineUpdateCheck() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  checkForAppUpdate({ forceToast: true });
}

/**
 * Called from registerSW onNeedRefresh (required API).
 */
export function handleServiceWorkerUpdate(updateSW) {
  if (typeof updateSW === "function") {
    pendingSwApply = async () => {
      // Listen once for controllerchange then reload
      let reloaded = false;
      const onController = () => {
        if (reloaded) return;
        reloaded = true;
        navigator.serviceWorker?.removeEventListener?.(
          "controllerchange",
          onController,
        );
        window.location.reload();
      };
      try {
        navigator.serviceWorker?.addEventListener?.(
          "controllerchange",
          onController,
        );
      } catch {
        /* ignore */
      }
      await updateSW(true);
      // Fallback reload if no controllerchange
      setTimeout(() => {
        if (!reloaded) {
          reloaded = true;
          window.location.reload();
        }
      }, 2500);
    };
  }

  showUpdateAvailableToast({
    latest: {
      buildId: `sw-waiting-${Date.now()}`,
      version: getCurrentBuildMeta().version,
    },
    onUpdate: () => applyWebsiteUpdate(),
    onLater: () => {
      markDismissed(`sw-waiting`);
    },
  });

  // Also verify version.json in parallel
  checkForAppUpdate({ forceToast: true });
}

function ensurePoll() {
  if (pollTimer) return;
  if (typeof document !== "undefined" && document.hidden) return;
  pollTimer = setInterval(() => {
    if (document.hidden) return;
    checkForAppUpdate({ forceToast: true });
  }, POLL_MS);
}

/**
 * Start ultra-sensitive watcher (required API).
 */
export function startUpdateWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;

  // Clear reload guard after successful load
  window.addEventListener("load", () => {
    setTimeout(() => safeRemove(STORAGE_RELOAD_GUARD), 1500);
  });

  // App start
  checkForAppUpdate({ forceToast: true });

  ensurePoll();

  document.addEventListener("visibilitychange", handleVisibilityUpdateCheck);
  window.addEventListener("focus", handleVisibilityUpdateCheck);
  window.addEventListener("online", handleOnlineUpdateCheck);

  // Optional: socket event hook
  try {
    window.addEventListener("app:update_available", () => {
      checkForAppUpdate({ forceToast: true });
    });
  } catch {
    /* ignore */
  }
}

/**
 * Stop polling (required API). keepListeners for pause-on-hide.
 */
export function stopUpdateWatcher({ keepListeners = false } = {}) {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (!keepListeners) {
    started = false;
    document.removeEventListener(
      "visibilitychange",
      handleVisibilityUpdateCheck,
    );
    window.removeEventListener("focus", handleVisibilityUpdateCheck);
    window.removeEventListener("online", handleOnlineUpdateCheck);
  }
}

/** Wire pending SW apply from registerSW without toast (optional) */
export function setPendingSwApply(fn) {
  pendingSwApply = typeof fn === "function" ? fn : null;
}
