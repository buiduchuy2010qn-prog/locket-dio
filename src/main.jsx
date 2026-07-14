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

const rootEl = document.getElementById("root");
createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// PWA + update watcher sau first paint — không tranh main thread lúc boot
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
