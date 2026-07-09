import Sidebar from "@/components/Sidebar";
import SnowEffect from "@/components/Effects/SnowEffect";
import React from "react";

/**
 * Layout Locket: nền hồng + tuyết rơi mượt (full màn hình mobile).
 */
const LocketLayout = ({ children }) => {
  return (
    <div className="locket-shell">
      <SnowEffect
        snowflakeCount={48}
        containerHeight={typeof window !== "undefined" ? window.innerHeight : 900}
        className="fixed inset-0 z-[2]"
      />
      <main className="relative z-[3] overflow-hidden text-base-content min-h-[100dvh] min-h-screen">
        {children}
      </main>
      <Sidebar />
    </div>
  );
};

export default LocketLayout;
