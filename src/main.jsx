import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/animation.css";
import App from "./App.jsx";
import { registerSW } from "virtual:pwa-register";

/**
 * KHÔNG tự reload khi đang dùng app.
 * - Chỉ kiểm tra update thưa (vài giờ / khi tab ẩn lâu)
 * - Có bản mới → hiện banner nhẹ, user bấm mới reload
 * - Lưu flag để lần mở app sau có thể apply êm
 */
let pendingUpdate = null;
let bannerEl = null;

function showUpdateBanner(applyUpdate) {
  if (bannerEl || typeof document === "undefined") return;

  bannerEl = document.createElement("div");
  bannerEl.setAttribute("role", "status");
  bannerEl.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:18px",
    "transform:translateX(-50%)",
    "z-index:99999",
    "display:flex",
    "align-items:center",
    "gap:10px",
    "padding:10px 14px",
    "border-radius:999px",
    "background:rgba(20,20,20,0.92)",
    "color:#fff",
    "font:600 13px/1.3 system-ui,sans-serif",
    "box-shadow:0 8px 28px rgba(0,0,0,.35)",
    "max-width:min(92vw,420px)",
  ].join(";");

  const text = document.createElement("span");
  text.textContent = "Có bản mới";
  text.style.opacity = "0.95";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Cập nhật";
  btn.style.cssText =
    "border:0;border-radius:999px;padding:6px 12px;background:#fbbf24;color:#111;font:700 12px system-ui;cursor:pointer";
  btn.onclick = () => {
    try {
      sessionStorage.setItem("sw_apply_update", "1");
    } catch {
      /* ignore */
    }
    applyUpdate();
  };

  const later = document.createElement("button");
  later.type = "button";
  later.textContent = "Để sau";
  later.style.cssText =
    "border:0;background:transparent;color:rgba(255,255,255,.75);font:600 12px system-ui;cursor:pointer;padding:4px 6px";
  later.onclick = () => {
    try {
      sessionStorage.setItem("sw_update_snooze", String(Date.now()));
    } catch {
      /* ignore */
    }
    bannerEl?.remove();
    bannerEl = null;
  };

  bannerEl.append(text, btn, later);
  document.body.appendChild(bannerEl);
}

function shouldSnoozeBanner() {
  try {
    const t = Number(sessionStorage.getItem("sw_update_snooze") || 0);
    // Ẩn banner 2 giờ sau khi bấm "Để sau"
    return t && Date.now() - t < 2 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    pendingUpdate = () => updateSW(true);
    console.log("[app] Bản SW mới sẵn sàng — không auto-reload");

    // User chủ động bấm cập nhật ở session trước
    try {
      if (sessionStorage.getItem("sw_apply_update") === "1") {
        sessionStorage.removeItem("sw_apply_update");
        updateSW(true);
        return;
      }
    } catch {
      /* ignore */
    }

    if (!shouldSnoozeBanner()) {
      // Đợi DOM sẵn sàng
      if (document.readyState === "loading") {
        document.addEventListener(
          "DOMContentLoaded",
          () => showUpdateBanner(() => updateSW(true)),
          { once: true }
        );
      } else {
        showUpdateBanner(() => updateSW(true));
      }
    }
  },
  onOfflineReady() {
    console.log("[app] Offline ready");
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    // Check update thưa: mỗi 6 giờ, KHÔNG check mỗi lần focus (gây reload liên tục)
    const check = () => {
      registration.update().catch(() => {});
    };

    // Lần đầu sau 5 phút (không chặn lúc vừa mở app)
    setTimeout(check, 5 * 60 * 1000);
    setInterval(check, 6 * 60 * 60 * 1000);

    // Chỉ check khi tab ẩn → hiện lại sau ≥ 30 phút
    let hiddenAt = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > 30 * 60 * 1000) {
        check();
        hiddenAt = 0;
      }
    });
  },
});

// Expose để Settings "Tải lại phiên bản mới" dùng nếu cần
if (typeof window !== "undefined") {
  window.__applyPwaUpdate = () => {
    if (pendingUpdate) pendingUpdate();
    else updateSW(true);
  };
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
