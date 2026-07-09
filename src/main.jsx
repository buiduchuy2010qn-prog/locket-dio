import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/animation.css";
import App from "./App.jsx";
import { registerSW } from "virtual:pwa-register";

// Ép SW cập nhật ngay — tránh kẹt bundle cũ (postMoment 500 / [object Object])
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log("🔄 Có bản SW mới — đang reload…");
    updateSW(true);
  },
  onOfflineReady() {
    console.log("✅ Offline ready");
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // Check update khi focus tab + mỗi 30 phút
    const check = () => registration.update().catch(() => {});
    check();
    setInterval(check, 30 * 60 * 1000);
    window.addEventListener("focus", check);
  },
});

// Một lần: dọn cache shell cũ nếu user từng cài PWA bản hỏng
if ("caches" in window) {
  caches.keys().then((keys) => {
    keys
      .filter((k) => /precache|workbox-precache|pages-v1|assets-v1/i.test(k))
      .forEach((k) => {
        console.log("[app] purge stale cache", k);
        caches.delete(k);
      });
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
