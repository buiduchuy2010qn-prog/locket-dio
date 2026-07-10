import { registerSW } from "virtual:pwa-register";

/**
 * PWA register — không ép reload giữa chừng (gây "tự tải lại" khi đang camera).
 * Bản mới chỉ áp khi user rời trang / reload tay.
 */
export function initPWA() {
  let waiting = false;

  const updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      waiting = true;
      console.log(
        "[PWA] Có bản mới — sẽ áp dụng khi tải lại trang (không auto-reload).",
      );
      // Không gọi updateSW(true) ở đây → tránh reload đột ngột / loop deploy.
    },
    onOfflineReady() {
      console.log("[PWA] Sẵn sàng offline");
    },
    onRegisteredSW(_url, registration) {
      // Kiểm tra update thưa hơn (mặc định có thể spam)
      if (!registration) return;
      setInterval(
        () => {
          try {
            registration.update();
          } catch {
            /* ignore */
          }
        },
        60 * 60 * 1000, // 1 giờ
      );
    },
  });

  // Khi user rời tab / đóng — có thể activate SW mới im lặng (không reload ngay)
  window.addEventListener("visibilitychange", () => {
    if (document.hidden && waiting) {
      // Không force reload; chỉ log. Lần F5 sau sẽ lấy bản mới.
      waiting = false;
    }
  });

  return updateSW;
}
