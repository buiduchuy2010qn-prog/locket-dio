import { registerSW } from "virtual:pwa-register";

const BANNER_ID = "pwa-update-banner";
const DISMISS_KEY = "pwa_update_dismissed_at";
const DISMISS_SCRIPT_KEY = "pwa_update_dismissed_script";
const LAST_CHECK_KEY = "pwa_update_last_check_at";
const SHOWN_SCRIPT_KEY = "pwa_update_shown_script";

/** Không hiện lại banner trong 24h nếu user bấm Hủy (localStorage) */
const DISMISS_MS = 24 * 60 * 60 * 1000;
/** Tối thiểu 10 phút giữa các lần registration.update() */
const CHECK_COOLDOWN_MS = 10 * 60 * 1000;
/** Debounce onNeedRefresh — tránh spam khi SW báo nhiều lần */
const NEED_REFRESH_DEBOUNCE_MS = 2500;

function now() {
  return Date.now();
}

function safeGet(key, storage = localStorage) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value, storage = localStorage) {
  try {
    storage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function isDismissedRecently(scriptUrl = "") {
  try {
    const t = Number(safeGet(DISMISS_KEY) || 0);
    if (!t || now() - t >= DISMISS_MS) return false;
    // Nếu dismiss cho đúng script waiting này → không hiện lại
    const dismissedScript = safeGet(DISMISS_SCRIPT_KEY) || "";
    if (!scriptUrl || !dismissedScript) return true;
    return dismissedScript === scriptUrl;
  } catch {
    return false;
  }
}

function markDismissed(scriptUrl = "") {
  safeSet(DISMISS_KEY, String(now()));
  if (scriptUrl) safeSet(DISMISS_SCRIPT_KEY, scriptUrl);
}

function alreadyShownForScript(scriptUrl) {
  if (!scriptUrl) return false;
  return safeGet(SHOWN_SCRIPT_KEY) === scriptUrl;
}

function markShownForScript(scriptUrl) {
  if (scriptUrl) safeSet(SHOWN_SCRIPT_KEY, scriptUrl);
}

function canRunUpdateCheck() {
  const last = Number(safeGet(LAST_CHECK_KEY) || 0);
  if (last && now() - last < CHECK_COOLDOWN_MS) return false;
  safeSet(LAST_CHECK_KEY, String(now()));
  return true;
}

function removeBanner() {
  document.getElementById(BANNER_ID)?.remove();
}

function getWaitingScriptUrl(registration) {
  try {
    return (
      registration?.waiting?.scriptURL ||
      registration?.installing?.scriptURL ||
      ""
    );
  } catch {
    return "";
  }
}

/**
 * Chip mini: chỉ chữ "Cập nhật" + × — không banner to, không nhảy liên tục.
 */
function showUpdateBanner(onUpdate, onCancel, scriptUrl = "") {
  if (document.getElementById(BANNER_ID)) return;
  if (isDismissedRecently(scriptUrl)) return;
  // Cùng bản SW đã hiện rồi trong session → không spam lại
  if (scriptUrl && alreadyShownForScript(scriptUrl)) {
    // Vẫn cho hiện lại sau dismiss hết hạn
    const t = Number(safeGet(DISMISS_KEY) || 0);
    if (t && now() - t < DISMISS_MS) return;
  }

  markShownForScript(scriptUrl);

  const wrap = document.createElement("div");
  wrap.id = BANNER_ID;
  wrap.setAttribute("role", "status");
  wrap.setAttribute("aria-live", "polite");
  wrap.setAttribute("aria-label", "Có bản cập nhật mới");

  Object.assign(wrap.style, {
    position: "fixed",
    left: "50%",
    bottom: "max(12px, env(safe-area-inset-bottom))",
    transform: "translateX(-50%)",
    zIndex: "999990",
    padding: "4px 6px 4px 10px",
    borderRadius: "999px",
    background: "rgba(30, 20, 40, 0.88)",
    color: "#fff",
    boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.12)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    maxWidth: "calc(100vw - 24px)",
    // Vào êm, không “nhảy” đột ngột
    animation: "pwaUpdateIn 0.28s ease-out",
  });

  // Inject keyframes once
  if (!document.getElementById("pwa-update-anim-style")) {
    const style = document.createElement("style");
    style.id = "pwa-update-anim-style";
    style.textContent = `
      @keyframes pwaUpdateIn {
        from { opacity: 0; transform: translateX(-50%) translateY(8px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  const btnUpdate = document.createElement("button");
  btnUpdate.type = "button";
  btnUpdate.textContent = "Cập nhật";
  Object.assign(btnUpdate.style, {
    padding: "0",
    margin: "0",
    border: "none",
    background: "transparent",
    color: "#f9a8d4",
    fontWeight: "600",
    fontSize: "12px",
    lineHeight: "1.2",
    letterSpacing: "0.01em",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  const btnCancel = document.createElement("button");
  btnCancel.type = "button";
  btnCancel.textContent = "×";
  btnCancel.setAttribute("aria-label", "Hủy");
  Object.assign(btnCancel.style, {
    padding: "0 4px",
    margin: "0",
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
    fontSize: "14px",
    lineHeight: "1",
    cursor: "pointer",
  });

  btnCancel.onclick = () => {
    markDismissed(scriptUrl);
    removeBanner();
    onCancel?.();
  };

  btnUpdate.onclick = () => {
    btnUpdate.disabled = true;
    btnUpdate.textContent = "…";
    btnCancel.disabled = true;
    // Clear dismiss so next real update can show
    try {
      localStorage.removeItem(DISMISS_KEY);
      localStorage.removeItem(DISMISS_SCRIPT_KEY);
      localStorage.removeItem(SHOWN_SCRIPT_KEY);
    } catch {
      /* ignore */
    }
    onUpdate?.();
  };

  wrap.appendChild(btnUpdate);
  wrap.appendChild(btnCancel);
  document.body.appendChild(wrap);
}

/**
 * PWA register — KHÔNG tự reload.
 * Có bản mới → hiện nút Cập nhật / Hủy (không spam).
 */
export function initPWA() {
  let registration = null;
  let needRefreshTimer = null;
  let lastNeedRefreshAt = 0;

  const promptRefresh = (reg) => {
    const scriptUrl = getWaitingScriptUrl(reg || registration);
    const t = now();
    // Debounce: nhiều sự kiện onNeedRefresh liên tiếp → 1 lần hiện
    if (t - lastNeedRefreshAt < NEED_REFRESH_DEBOUNCE_MS) return;
    lastNeedRefreshAt = t;

    if (needRefreshTimer) clearTimeout(needRefreshTimer);
    needRefreshTimer = setTimeout(() => {
      needRefreshTimer = null;
      console.log("[PWA] Có bản mới — chờ user chọn Cập nhật hoặc Hủy");
      showUpdateBanner(
        () => {
          try {
            updateSW?.(true);
          } catch (e) {
            console.error("[PWA] update failed", e);
            window.location.reload();
          }
        },
        () => {
          console.log("[PWA] User hủy cập nhật");
        },
        scriptUrl,
      );
    }, 400);
  };

  const updateSW = registerSW({
    // prompt mode: không auto skipWaiting / reload
    immediate: false,
    onNeedRefresh() {
      promptRefresh(registration);
    },
    onOfflineReady() {
      console.log("[PWA] Sẵn sàng offline");
    },
    onRegisteredSW(_url, reg) {
      registration = reg || null;
      if (!registration) return;

      // Nếu đã có SW waiting sẵn (user quay lại sau deploy)
      if (registration.waiting) {
        promptRefresh(registration);
      }

      // Kiểm tra bản mới định kỳ (không reload) — 45 phút
      setInterval(
        () => {
          try {
            if (!canRunUpdateCheck()) return;
            registration.update();
          } catch {
            /* ignore */
          }
        },
        45 * 60 * 1000,
      );
    },
  });

  // Khi quay lại tab: check update có cooldown — tránh nhảy banner mỗi lần focus
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !registration) return;
    if (!canRunUpdateCheck()) return;
    try {
      registration.update();
    } catch {
      /* ignore */
    }
  });

  return updateSW;
}
