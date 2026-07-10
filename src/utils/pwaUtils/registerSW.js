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
 * Banner cố định: Cập nhật | Hủy — không tự reload.
 */
function showUpdateBanner(onUpdate, onCancel) {
  if (document.getElementById(BANNER_ID)) return;
  if (isDismissedRecently()) return;

  const wrap = document.createElement("div");
  wrap.id = BANNER_ID;
  wrap.setAttribute("role", "status");
  wrap.setAttribute("aria-live", "polite");

  Object.assign(wrap.style, {
    position: "fixed",
    left: "50%",
    bottom: "max(20px, env(safe-area-inset-bottom))",
    transform: "translateX(-50%)",
    zIndex: "999990",
    maxWidth: "min(420px, calc(100vw - 24px))",
    width: "100%",
    padding: "14px 16px",
    borderRadius: "16px",
    background: "rgba(30, 20, 40, 0.94)",
    color: "#fff",
    boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.12)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  });

  const text = document.createElement("div");
  text.innerHTML =
    "<div style='font-weight:700;font-size:15px;margin-bottom:4px'>Có bản cập nhật mới</div>" +
    "<div style='font-size:13px;opacity:0.85;line-height:1.4'>Ứng dụng đã có phiên bản mới. Bạn có muốn cập nhật ngay không?</div>";

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
  });

  const btnCancel = document.createElement("button");
  btnCancel.type = "button";
  btnCancel.textContent = "Hủy";
  Object.assign(btnCancel.style, {
    flex: "1",
    padding: "10px 14px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "#fff",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
  });

  const btnUpdate = document.createElement("button");
  btnUpdate.type = "button";
  btnUpdate.textContent = "Cập nhật";
  Object.assign(btnUpdate.style, {
    flex: "1",
    padding: "10px 14px",
    borderRadius: "12px",
    border: "none",
    background: "linear-gradient(135deg, #f472b6, #ec4899)",
    color: "#fff",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
  });

  btnCancel.onclick = () => {
    markDismissed();
    removeBanner();
    onCancel?.();
  };

  btnUpdate.onclick = () => {
    btnUpdate.disabled = true;
    btnUpdate.textContent = "Đang cập nhật…";
    btnCancel.disabled = true;
    onUpdate?.();
  };

  actions.appendChild(btnCancel);
  actions.appendChild(btnUpdate);
  wrap.appendChild(text);
  wrap.appendChild(actions);
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
