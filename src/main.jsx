import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
// Tailwind + DaisyUI (themes đã cắt gọn trong tailwind.css)
import "../tailwind.css";
import "./index.css";
import App from "./App.jsx";

import ErrorBoundary from "./components/pages/ErrorBoundary";
import {
  initPWA,
  initReloadState,
  startUpdateWatcher,
} from "./utils";
import { applyPerfClasses } from "./utils/device/perfProfile";

// Android / mobile: class perf-lite để giảm blur + effect
applyPerfClasses();

// Chunk recovery + local flags — nhẹ, sync OK
initReloadState();

// App boot OK → reset cờ recover removeChild
try {
  sessionStorage.removeItem("hl_dom_recover");
} catch {
  /* ignore */
}

/** Ẩn boot shell — chỉ CSS class, không đụng DOM tree của React */
function markBootReady() {
  try {
    document.documentElement.classList.add("boot-ready");
  } catch {
    /* ignore */
  }
}

const rootEl = document.getElementById("root");
if (rootEl) {
  // Tránh root “bẩn” từ SW/cache cũ (gây removeChild lệch fiber)
  try {
    if (rootEl.hasChildNodes()) rootEl.replaceChildren();
  } catch {
    try {
      rootEl.innerHTML = "";
    } catch {
      /* ignore */
    }
  }

  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );

  // Ẩn shell sau frame đầu — không MutationObserver trên #root
  requestAnimationFrame(() => {
    requestAnimationFrame(markBootReady);
  });
  // Phòng hờ
  setTimeout(markBootReady, 1200);
} else {
  markBootReady();
}

// PWA + update watcher sau first paint
const deferBoot = (fn) => {
  if (typeof window !== "undefined" && window.requestIdleCallback) {
    window.requestIdleCallback(fn, { timeout: 2500 });
  } else {
    setTimeout(fn, 400);
  }
};
deferBoot(() => {
  try {
    initPWA();
    startUpdateWatcher();
  } catch {
    /* ignore */
  }
});
