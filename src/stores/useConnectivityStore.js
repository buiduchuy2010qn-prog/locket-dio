import { create } from "zustand";

/**
 * Real connectivity: navigator.onLine + lightweight health probe.
 * - No continuous ping (battery)
 * - Re-check on online event, visibility, and before post
 * - serverReachable === true only after a successful health response
 */

const HEALTH_URL = "/dio-api/health";
const HEALTH_TIMEOUT_MS = 3500;
const MIN_PROBE_GAP_MS = 25_000;

let probeInflight = null;
let lastProbeAt = 0;
let listenersBound = false;

async function probeHealth(force = false) {
  if (typeof fetch !== "function") {
    return { ok: false, reason: "no-fetch" };
  }

  // Browser says offline → skip network
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, reason: "browser-offline" };
  }

  const now = Date.now();
  if (!force && probeInflight) return probeInflight;
  if (!force && now - lastProbeAt < MIN_PROBE_GAP_MS && lastProbeAt > 0) {
    return {
      ok: useConnectivityStore.getState().serverReachable,
      reason: "throttled",
    };
  }

  lastProbeAt = now;

  const run = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
    try {
      const res = await fetch(HEALTH_URL, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: ctrl.signal,
      });
      return { ok: Boolean(res?.ok), status: res?.status, reason: "health" };
    } catch {
      return { ok: false, reason: "network-error" };
    } finally {
      clearTimeout(timer);
    }
  })();

  probeInflight = run;
  try {
    return await run;
  } finally {
    if (probeInflight === run) probeInflight = null;
  }
}

export const useConnectivityStore = create((set, get) => ({
  /** browser online event */
  browserOnline:
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  /** last successful health probe */
  serverReachable: true,
  /** last probe finished at */
  checkedAt: 0,
  probing: false,
  /** user-facing offline (browser offline OR server unreachable) */
  isOffline: false,

  _applyResult: (browserOnline, serverOk) => {
    const isOffline = !browserOnline || !serverOk;
    set({
      browserOnline,
      serverReachable: serverOk,
      isOffline,
      checkedAt: Date.now(),
      probing: false,
    });
  },

  /**
   * @param {{ force?: boolean }} opts
   */
  checkConnectivity: async (opts = {}) => {
    const force = Boolean(opts.force);
    const browserOnline =
      typeof navigator === "undefined" ? true : navigator.onLine !== false;

    if (!browserOnline) {
      get()._applyResult(false, false);
      return { browserOnline: false, serverReachable: false };
    }

    set({ probing: true });
    const result = await probeHealth(force);
    const serverOk = Boolean(result.ok);
    get()._applyResult(true, serverOk);
    return { browserOnline: true, serverReachable: serverOk, ...result };
  },

  /** Call once from App shell */
  startConnectivityWatch: () => {
    if (typeof window === "undefined" || listenersBound) return () => {};
    listenersBound = true;

    const onOffline = () => {
      get()._applyResult(false, false);
    };
    const onOnline = () => {
      set({ browserOnline: true });
      // Verify server when link comes back (force)
      void get().checkConnectivity({ force: true });
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void get().checkConnectivity({ force: false });
      }
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);

    // Initial probe (not force-spam)
    void get().checkConnectivity({ force: true });

    return () => {
      listenersBound = false;
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
    };
  },
}));
