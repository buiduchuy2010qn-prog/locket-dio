import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import "./index.css";
import App from "./App.jsx";

import ErrorBoundary from "./components/pages/ErrorBoundary";
import {
  initChunkRecovery,
  initPWA,
  initReloadState,
  startUpdateWatcher,
} from "./utils";
import { applyPerfClasses } from "./utils/device/perfProfile";

// Android / mobile: class perf-lite để giảm blur + effect
applyPerfClasses();

// init PWA + ultra-sensitive version.json watcher
initPWA();
startUpdateWatcher();

// init chunk recovery
initReloadState();

// initChunkRecovery();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
