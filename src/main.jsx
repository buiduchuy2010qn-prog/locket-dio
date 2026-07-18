import { createRoot } from "react-dom/client";
import "./i18n";
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
import { bootThemeEarly } from "./utils/theme/themeUtils";

// Theme + snow intensity before first paint (localStorage)
bootThemeEarly();

// Android / mobile: class perf-lite để giảm blur + effect
applyPerfClasses();

// init chunk recovery flags
initReloadState();
try {
  sessionStorage.removeItem("hl_dom_recover_v2");
} catch {
  /* ignore */
}

const rootEl = document.getElementById("root");
if (rootEl) {
  // Chống Google Translate / extension bọc text → removeChild
  try {
    rootEl.setAttribute("translate", "no");
  } catch {
    /* ignore */
  }

  // KHÔNG StrictMode production — double-mount + DOM manual (cam/snow) hay gây removeChild
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

// PWA: register SW ASAP so offline shell is ready after first visit.
// Update watcher can wait — not needed for offline control.
try {
  initPWA();
} catch {
  /* ignore */
}
const defer = (fn) => {
  if (typeof window !== "undefined" && window.requestIdleCallback) {
    window.requestIdleCallback(fn, { timeout: 3000 });
  } else {
    setTimeout(fn, 500);
  }
};
defer(() => {
  try {
    startUpdateWatcher();
  } catch {
    /* ignore */
  }
});
