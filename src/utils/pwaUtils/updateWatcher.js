/**
 * App update:
 * - Nút tròn luôn có → user bấm = cập nhật ngay
 * - Tự cập nhật CHỈ khi user không vào web ≥ 30 phút rồi mới quay lại
 * - Không toast, không auto khi đang xài app
 */

import currentBuild from "@/config/buildMeta.json";

const STORAGE_BUILD = "app_known_build_id";
const STORAGE_RELOAD_GUARD = "app_update_reload_guard";
/** Lần cuối user rời / ẩn tab web (ms epoch) */
const STORAGE_LAST_AWAY = "app_last_away_at";
/** Lần cuối user đang active trên web */
const STORAGE_LAST_ACTIVE = "app_last_active_at";

const POLL_MS = 5 * 60 * 1000;
/** Chỉ auto-update nếu đã vắng ≥ 30 phút */
const AWAY_AUTO_UPDATE_MS = 30 * 60 * 1000;
const RELOAD_GUARD_MS = 20 * 1000;
const EVENT_NAME = "app:update_state";

let pollTimer = null;
let started = false;
let checking = false;
let autoUpdating = false;
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

function markActive() {
  safeSet(STORAGE_LAST_ACTIVE, String(now()));
}

function markAway() {
  safeSet(STORAGE_LAST_AWAY, String(now()));
}

/**
 * Đã vắng web đủ lâu chưa (≥ 30 phút).
 * Dùng last_away; fallback last_active nếu không có mốc rời.
 */
function hasBeenAwayLongEnough() {
  const awayRaw = safeGet(STORAGE_LAST_AWAY);
  const activeRaw = safeGet(STORAGE_LAST_ACTIVE);
  const t = now();

  if (awayRaw) {
    const awayAt = Number(awayRaw);
    if (Number.isFinite(awayAt) && t - awayAt >= AWAY_AUTO_UPDATE_MS) {
      return true;
    }
    // Rời tab gần đây (< 30p) → không auto
    if (Number.isFinite(awayAt) && t - awayAt < AWAY_AUTO_UPDATE_MS) {
      return false;
    }
  }

  // Lần đầu / không có mốc away: chỉ auto nếu last active cũng đã cũ ≥ 30p
  // (đóng browser lâu rồi mở lại)
  if (activeRaw) {
    const activeAt = Number(activeRaw);
    if (Number.isFinite(activeAt) && t - activeAt >= AWAY_AUTO_UPDATE_MS) {
      return true;
    }
  }

  // Chưa từng có mốc → coi là session mới, không ép auto (user bấm nút)
  return false;
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

export function subscribeAppUpdate(listener) {
  if (typeof listener !== "function") return () => {};
  const handler = (e) => listener(e?.detail || getAppUpdateState());
  window.addEventListener(EVENT_NAME, handler);
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
 * @param {string} [targetBuildId]
 * @param {{ force?: boolean }} [opts]
 */
export async function applyWebsiteUpdate(targetBuildId, opts = {}) {
  const force = Boolean(opts.force);
  const guard = safeGet(STORAGE_RELOAD_GUARD);
  if (guard && !force) {
    try {
      const { at } = JSON.parse(guard);
      if (now() - Number(at || 0) < RELOAD_GUARD_MS) {
        console.warn("[update] reload guard active — skip");
        return false;
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
      return true;
    } catch (e) {
      console.warn("[update] SW apply failed, hard reload", e);
    }
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now()));
  window.location.replace(url.pathname + url.search + url.hash);
  return true;
}

/** Silent check — chấm hồng trên nút. Không auto reload. */
export async function checkForAppUpdate() {
  if (checking) return updateState.available;
  if (typeof document !== "undefined" && document.hidden) {
    return updateState.available;
  }

  checking = true;
  try {
    const latest = await fetchLatestVersion();
    const current = getCurrentBuildMeta();

    if (latest.buildId === current.buildId && !updateState.swWaiting) {
      safeSet(STORAGE_BUILD, latest.buildId);
      safeRemove(STORAGE_RELOAD_GUARD);
      publishState({ available: false, latest: null });
      return false;
    }

    if (latest.buildId === current.buildId && updateState.swWaiting) {
      publishState({ available: true, latest });
      return true;
    }

    publishState({ available: true, latest });
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

/**
 * Tự cập nhật CHỈ khi đã vắng web ≥ 30 phút.
 */
export async function autoUpdateIfAvailable() {
  if (autoUpdating) return false;
  if (typeof document !== "undefined" && document.hidden) return false;

  if (!hasBeenAwayLongEnough()) {
    // Vẫn check để hiện chấm hồng, không reload
    await checkForAppUpdate();
    return false;
  }

  const guard = safeGet(STORAGE_RELOAD_GUARD);
  if (guard) {
    try {
      const { at } = JSON.parse(guard);
      if (now() - Number(at || 0) < RELOAD_GUARD_MS) return false;
    } catch {
      /* ignore */
    }
  }

  autoUpdating = true;
  try {
    const has = await checkForAppUpdate();
    if (!has) return false;
    const buildId = updateState.latest?.buildId;
    console.log(
      "[update] auto-apply after ≥30m away, build=",
      buildId,
    );
    await applyWebsiteUpdate(buildId);
    return true;
  } catch (e) {
    console.warn("[update] autoUpdate failed", e);
    return false;
  } finally {
    autoUpdating = false;
  }
}

/** User bấm nút — cập nhật ngay, không cần chờ 30p */
export async function userForceUpdate() {
  try {
    await checkForAppUpdate();
  } catch {
    /* ignore */
  }
  const buildId = updateState.latest?.buildId;
  return applyWebsiteUpdate(buildId, { force: true });
}

export function handleVisibilityUpdateCheck() {
  if (document.visibilityState !== "visible") {
    // Rời tab / ẩn app → ghi mốc away
    markAway();
    stopUpdateWatcher({ keepListeners: true });
    return;
  }

  // Quay lại tab
  markActive();
  if (started) ensurePoll();

  // Chỉ auto nếu đã vắng ≥ 30 phút
  autoUpdateIfAvailable();
}

export function handleOnlineUpdateCheck() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  // Online lại: chỉ auto nếu đã vắng đủ lâu
  autoUpdateIfAvailable();
}

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

  // SW waiting → chỉ badge, không auto (trừ khi đã vắng ≥ 30p)
  publishState({
    available: true,
    swWaiting: true,
    latest: updateState.latest || {
      buildId: "sw-waiting",
      version: getCurrentBuildMeta().version,
    },
  });
  checkForAppUpdate();
}

function ensurePoll() {
  if (pollTimer) return;
  if (typeof document !== "undefined" && document.hidden) return;
  pollTimer = setInterval(() => {
    if (document.hidden) return;
    markActive();
    // Poll chỉ cập nhật badge, không auto reload
    checkForAppUpdate();
  }, POLL_MS);
}

export function startUpdateWatcher() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("load", () => {
    setTimeout(() => safeRemove(STORAGE_RELOAD_GUARD), 2500);
  });

  // Session mở: thử auto chỉ nếu đã vắng ≥ 30p từ lần trước
  autoUpdateIfAvailable().finally(() => {
    markActive();
  });
  ensurePoll();

  document.addEventListener("visibilitychange", handleVisibilityUpdateCheck);
  // focus: không auto mỗi lần focus — chỉ mark active + check badge
  window.addEventListener("focus", () => {
    if (document.visibilityState === "visible") {
      markActive();
      checkForAppUpdate();
    }
  });
  window.addEventListener("online", handleOnlineUpdateCheck);

  window.addEventListener("pagehide", () => {
    markAway();
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      autoUpdateIfAvailable().finally(() => markActive());
    }
  });
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
    window.removeEventListener("online", handleOnlineUpdateCheck);
  }
}

export function setPendingSwApply(fn) {
  pendingSwApply = typeof fn === "function" ? fn : null;
}

/** @deprecated */
export function showUpdateAvailableToast() {}
