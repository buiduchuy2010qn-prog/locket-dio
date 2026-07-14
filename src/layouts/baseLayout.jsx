import React, { Suspense, useEffect, useState } from "react";

// Sidebar nặng (lucide icons) — load sau first paint, không chặn camera
const Sidebar = React.lazy(() => import("@/components/Sidebar"));

function idle(cb, timeout = 1200) {
  if (typeof window !== "undefined" && window.requestIdleCallback) {
    return window.requestIdleCallback(cb, { timeout });
  }
  return setTimeout(cb, Math.min(timeout, 400));
}

function cancelIdle(id) {
  if (typeof window !== "undefined" && window.cancelIdleCallback) {
    try {
      window.cancelIdleCallback(id);
      return;
    } catch {
      /* ignore */
    }
  }
  clearTimeout(id);
}

export default function LayoutWithSidebar({ Layout, children }) {
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    // Idle sớm (~0.4–0.8s) — menu vẫn kịp khi user mở
    const id = idle(() => setShowSidebar(true), 800);
    return () => cancelIdle(id);
  }, []);

  return (
    <div className="flex">
      <div>
        {showSidebar ? (
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
        ) : null}
      </div>

      <div className="flex-1 bg-base-100 text-base-content overflow-hidden">
        <Layout>{children}</Layout>
      </div>
    </div>
  );
}
