/**
 * App update detector — silent poll + user-initiated button.
 * No auto toast spam. UI shows a small "Cập nhật" control when available.
 */

import currentBuild from "@/config/buildMeta.json";

const STORAGE_BUILD = "app_known_build_id";
const STORAGE_RELOAD_GUARD = "app_update_reload_guard";

const POLL_MS = 5 * 60 * 1000;
const FOCUS_COOLDOWN_MS = 2 * 60 * 1000;
const RELOAD_GUARD_MS = 15 * 1000;
const EVENT_NAME = "app:update_state";

let pollTimer = null;
let started = false;
let checking = false;
let lastFocusCheck = 0;
/** @type {null | (() => void | Promise<void>)} */
let pendingSwApply = null;
/** @type {{ available: boolean, latest: object | null, swWaiting: boolean }} */
let updateState = { available: false, latest: null, swWaiting: false };

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

function publishState(partial) {
  updateState = { ...updateState, ...partial };
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: { ...updateState } }),
    );
  } catch {
    /* ignore */
  }
}

export function getAppUpdateState() {
  return { ...updateState };
}

/** Subscribe to silent update availability (for the Cập nhật button). */
export function subscribeAppUpdate(listener) {
  if (typeof listener !== "function") return () => {};
  const handler = (e) => listener(e?.detail || getAppUpdateState());
  window.addEventListener(EVENT_NAME, handler);
  // Emit current immediately
  try {
    listener(getAppUpdateState());
  } catch {
    /* ignore */
  }
  return () => window.removeEventListener(EVENT_NAME, handler);
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
 * User pressed "Cập nhật" — apply SW / hard reload.
 * @param {string} [targetBuildId]
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

  safeSet(STORAGE_RELOAD_GUARD, JSON.stringify({ at: now() }));

  const target =
    targetBuildId ||
    updateState.latest?.buildId ||
    getCurrentBuildMeta().buildId;
  safeSet(STORAGE_BUILD, target);

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
  window.location.replace(url.pathname + url.search + url.hash);
}

/**
 * Silent check — no toast. Sets available state for the button.
 * @returns {Promise<boolean>}
 */
export async function checkForAppUpdate() {
  if (checking) return updateState.available;
  if (typeof document !== "undefined" && document.hidden) {
    return updateState.available;
  }

  checking = true;
  try {
    const latest = await fetchLatestVersion();
    const current = getCurrentBuildMeta();

    if (latest.buildId === current.buildId) {
      safeSet(STORAGE_BUILD, latest.buildId);
      safeRemove(STORAGE_RELOAD_GUARD);
      publishState({
        available: updateState.swWaiting, // still show if SW waiting
        latest: updateState.swWaiting ? latest : null,
      });
      return updateState.available;
    }

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

    publishState({
      available: true,
      latest,
    });
    return true;
  } catch (e) {
    if (import.meta.env?.DEV) {
      console.debug("[update] check skipped", e?.message || e);
    }
    return updateState.available;
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
  checkForAppUpdate();
}

export function handleOnlineUpdateCheck() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  if (now() - lastFocusCheck < FOCUS_COOLDOWN_MS) return;
  lastFocusCheck = now();
  checkForAppUpdate();
}

/**
 * SW has a waiting worker — mark available, no toast.
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

  publishState({
    available: true,
    swWaiting: true,
    latest: updateState.latest || {
      buildId: "sw-waiting",
      version: getCurrentBuildMeta().version,
    },
  });

  // Enrich with version.json if remote is newer
  checkForAppUpdate();
}

function ensurePoll() {
  if (pollTimer) return;
  if (typeof document !== "undefined" && document.hidden) return;
  pollTimer = setInterval(() => {
    if (document.hidden) return;
    checkForAppUpdate();
  }, POLL_MS);
}

export function startUpdateWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("load", () => {
    setTimeout(() => safeRemove(STORAGE_RELOAD_GUARD), 2000);
  });

  checkForAppUpdate();
  ensurePoll();

  document.addEventListener("visibilitychange", handleVisibilityUpdateCheck);
  window.addEventListener("focus", handleVisibilityUpdateCheck);
  window.addEventListener("online", handleOnlineUpdateCheck);
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

/** @deprecated toast removed — use AppUpdateButton */
export function showUpdateAvailableToast() {
  // no-op: keep export so old imports don't crash
}
