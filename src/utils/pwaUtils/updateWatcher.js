/**
 * Website update detector — calm, no toast spam.
 * Polls /version.json occasionally; SW waiting uses a stable key.
 * Toast once per buildId until user updates or dismisses (24h).
 */

import currentBuild from "@/config/buildMeta.json";

const TOAST_ID = "app-update-toast";
const STYLE_ID = "app-update-toast-style";
const STORAGE_BUILD = "app_known_build_id";
const STORAGE_DISMISS = "app_update_dismissed_build";
const STORAGE_RELOAD_GUARD = "app_update_reload_guard";
/** Poll only every 5 minutes while tab visible */
const POLL_MS = 5 * 60 * 1000;
/** "Để sau" hides this build for 24h */
const DISMISS_MS = 24 * 60 * 60 * 1000;
/** Don't re-check on focus more than once per 2 min */
const FOCUS_COOLDOWN_MS = 2 * 60 * 1000;
/** Block reload loops */
const RELOAD_GUARD_MS = 15 * 1000;

const SW_WAITING_KEY = "sw-waiting";

let pollTimer = null;
let started = false;
let checking = false;
let lastFocusCheck = 0;
/** buildIds already toasted this page session */
const offeredThisSession = new Set();
/** @type {null | (() => void | Promise<void>)} */
let pendingSwApply = null;
/** Remote buildId we last detected as newer */
let pendingRemoteBuildId = null;

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
 * Fetch /version.json with cache bust.
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
  offeredThisSession.add(buildId);
}

/** Session only — one toast per buildId until tab fully reloads */
function wasOffered(buildId) {
  return offeredThisSession.has(buildId);
}

function markOffered(buildId) {
  offeredThisSession.add(buildId);
}

function removeUpdateToast() {
  document.getElementById(TOAST_ID)?.remove();
}

/**
 * Glassmorphism update toast — once per buildId.
 */
export function showUpdateAvailableToast({
  latest,
  onUpdate,
  onLater,
} = {}) {
  const buildId = latest?.buildId || "unknown";

  if (!buildId || buildId === "unknown") return;
  if (isDismissedForBuild(buildId)) return;
  if (wasOffered(buildId) && document.getElementById(TOAST_ID)) return;
  // Already offered this session (user closed without "Để sau" or still open)
  if (wasOffered(buildId)) return;
  if (document.getElementById(TOAST_ID)) return;

  markOffered(buildId);
  pendingRemoteBuildId = buildId;

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
  aside.dataset.buildId = buildId;

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
      await (onUpdate?.() ?? applyWebsiteUpdate(buildId));
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
 * Apply update safely — no infinite reload loop.
 * @param {string} [targetBuildId] remote buildId we're updating to
 */
export async function applyWebsiteUpdate(targetBuildId) {
  const guard = safeGet(STORAGE_RELOAD_GUARD);
  if (guard) {
    try {
      const { at } = JSON.parse(guard);
      if (now() - Number(at || 0) < RELOAD_GUARD_MS) {
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

  // Mark target (remote) as known so next load doesn't re-prompt immediately
  const target =
    targetBuildId ||
    pendingRemoteBuildId ||
    getCurrentBuildMeta().buildId;
  safeSet(STORAGE_BUILD, target);
  markOffered(target);
  // Don't keep dismiss forever after update
  safeRemove(STORAGE_DISMISS);

  await clearOldAppCache();

  if (typeof pendingSwApply === "function") {
    try {
      await pendingSwApply();
      return;
    } catch (e) {
      console.warn("[update] SW apply failed, hard reload", e);
    }
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now()));
  // Drop old cache-bust params clutter
  window.location.replace(url.pathname + url.search + url.hash);
}

/**
 * Compare remote vs local buildId.
 * @returns {Promise<boolean>} true if update available
 */
export async function checkForAppUpdate({ forceToast = false } = {}) {
  if (checking) return false;
  if (typeof document !== "undefined" && document.hidden) {
    return false;
  }

  checking = true;
  try {
    const latest = await fetchLatestVersion();
    const current = getCurrentBuildMeta();
    const known = safeGet(STORAGE_BUILD);

    // Already running the deployed build
    if (latest.buildId === current.buildId) {
      safeSet(STORAGE_BUILD, latest.buildId);
      safeRemove(STORAGE_RELOAD_GUARD);
      offeredThisSession.delete(latest.buildId);
      removeUpdateToast();
      return false;
    }

    // Just reloaded — don't re-prompt for a few seconds (SW lag)
    const guard = safeGet(STORAGE_RELOAD_GUARD);
    if (guard) {
      try {
        const { at } = JSON.parse(guard);
        if (now() - Number(at || 0) < RELOAD_GUARD_MS) {
          return true;
        }
      } catch {
        /* ignore */
      }
    }

    if (!latest.buildId || isDismissedForBuild(latest.buildId)) {
      return false;
    }

    // User already clicked update toward this build this session
    if (known === latest.buildId && wasOffered(latest.buildId)) {
      return true;
    }

    pendingRemoteBuildId = latest.buildId;

    // Toast at most once per buildId per page session
    if (forceToast !== false && !wasOffered(latest.buildId)) {
      showUpdateAvailableToast({
        latest,
        onUpdate: () => applyWebsiteUpdate(latest.buildId),
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
  if (now() - lastFocusCheck < FOCUS_COOLDOWN_MS) return;
  lastFocusCheck = now();

  if (started) ensurePoll();

  // Quiet check: only toast if never offered this build
  checkForAppUpdate({ forceToast: true });
}

export function handleOnlineUpdateCheck() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (now() - lastFocusCheck < FOCUS_COOLDOWN_MS) return;
  lastFocusCheck = now();
  checkForAppUpdate({ forceToast: true });
}

/**
 * Called from registerSW onNeedRefresh — stable key, no Date.now spam.
 */
export function handleServiceWorkerUpdate(updateSW) {
  if (typeof updateSW === "function") {
    pendingSwApply = async () => {
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
      setTimeout(() => {
        if (!reloaded) {
          reloaded = true;
          window.location.reload();
        }
      }, 2500);
    };
  }

  // Prefer real version.json buildId; fall back to stable SW key once
  checkForAppUpdate({ forceToast: true }).then((hasVersionUpdate) => {
    if (hasVersionUpdate) return;
    // SW waiting but version.json already matches (or fetch failed) — one toast
    if (isDismissedForBuild(SW_WAITING_KEY) || wasOffered(SW_WAITING_KEY)) {
      return;
    }
    showUpdateAvailableToast({
      latest: {
        buildId: SW_WAITING_KEY,
        version: getCurrentBuildMeta().version,
      },
      onUpdate: () => applyWebsiteUpdate(SW_WAITING_KEY),
      onLater: () => markDismissed(SW_WAITING_KEY),
    });
  });
}

function ensurePoll() {
  if (pollTimer) return;
  if (typeof document !== "undefined" && document.hidden) return;
  pollTimer = setInterval(() => {
    if (document.hidden) return;
    checkForAppUpdate({ forceToast: true });
  }, POLL_MS);
}

export function startUpdateWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("load", () => {
    setTimeout(() => safeRemove(STORAGE_RELOAD_GUARD), 2000);
  });

  // One check on start
  checkForAppUpdate({ forceToast: true });
  ensurePoll();

  document.addEventListener("visibilitychange", handleVisibilityUpdateCheck);
  // focus is noisy — use same handler with cooldown
  window.addEventListener("focus", handleVisibilityUpdateCheck);
  window.addEventListener("online", handleOnlineUpdateCheck);

  try {
    window.addEventListener("app:update_available", () => {
      checkForAppUpdate({ forceToast: true });
    });
  } catch {
    /* ignore */
  }
}

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

export function setPendingSwApply(fn) {
  pendingSwApply = typeof fn === "function" ? fn : null;
}
