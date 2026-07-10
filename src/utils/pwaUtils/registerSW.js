import { registerSW } from "virtual:pwa-register";

const BANNER_ID = "pwa-update-banner";
const DISMISS_KEY = "pwa_update_dismissed_at";
/** Không hiện lại banner trong 4h nếu user bấm Hủy */
const DISMISS_MS = 4 * 60 * 60 * 1000;

function isDismissedRecently() {
  try {
    const t = Number(sessionStorage.getItem(DISMISS_KEY) || 0);
    return t && Date.now() - t < DISMISS_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function removeBanner() {
  document.getElementById(BANNER_ID)?.remove();
}

/**
 * Chip mini: chỉ chữ "Cập nhật" + × — không banner to.
 */
function showUpdateBanner(onUpdate, onCancel) {
  if (document.getElementById(BANNER_ID)) return;
  if (isDismissedRecently()) return;

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
  });

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
    markDismissed();
    removeBanner();
    onCancel?.();
  };

  btnUpdate.onclick = () => {
    btnUpdate.disabled = true;
    btnUpdate.textContent = "…";
    btnCancel.disabled = true;
    onUpdate?.();
  };

  wrap.appendChild(btnUpdate);
  wrap.appendChild(btnCancel);
  document.body.appendChild(wrap);
}

/**
 * PWA register — KHÔNG tự reload.
 * Có bản mới → hiện nút Cập nhật / Hủy.
 */
export function initPWA() {
  let registration = null;

  const updateSW = registerSW({
    // prompt mode: không auto skipWaiting / reload
    immediate: false,
    onNeedRefresh() {
      console.log("[PWA] Có bản mới — chờ user chọn Cập nhật hoặc Hủy");
      showUpdateBanner(
        () => {
          // true = skip waiting + reload
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
      );
    },
    onOfflineReady() {
      console.log("[PWA] Sẵn sàng offline");
    },
    onRegisteredSW(_url, reg) {
      registration = reg || null;
      if (!registration) return;

      // Kiểm tra bản mới định kỳ (không reload)
      setInterval(
        () => {
          try {
            registration.update();
          } catch {
            /* ignore */
          }
        },
        30 * 60 * 1000, // 30 phút
      );
    },
  });

  // Khi quay lại tab: check update (chỉ hiện banner, không reload)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && registration) {
      try {
        registration.update();
      } catch {
        /* ignore */
      }
    }
  });

  return updateSW;
}
