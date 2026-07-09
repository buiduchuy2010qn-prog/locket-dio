import Sidebar from "@/components/Sidebar";
import SnowEffect from "@/components/Effects/SnowEffect";
import React from "react";

/**
 * Layout Locket: nền hồng + tuyết ❄ rơi (demo HTML user).
 */
const LocketLayout = ({ children }) => {
  return (
    <div className="locket-shell">
      <SnowEffect intervalMs={80} maxFlakes={55} />
      <main className="relative z-[3] overflow-hidden text-base-content min-h-[100dvh] min-h-screen">
        {children}
      </main>
      <Sidebar />
    </div>
  );
};

export default LocketLayout;
