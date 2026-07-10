import Sidebar from "@/components/Sidebar";
import React from "react";

/**
 * Layout Locket: nền shell (tuyết toàn app qua GlobalThemeEffects).
 */
const LocketLayout = ({ children }) => {
  return (
    <div className="locket-shell">
      <main className="relative z-[3] overflow-hidden text-base-content min-h-[100dvh] min-h-screen">
        {children}
      </main>
      <Sidebar />
    </div>
  );
};

export default LocketLayout;
