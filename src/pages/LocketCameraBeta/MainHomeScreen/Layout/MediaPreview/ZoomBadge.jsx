import React from "react";
import { updateZoomBadge } from "@/utils";

/**
 * Small glassmorphism zoom badge — top-right of square camera frame only.
 * Never place near caption / top-left.
 */
const ZoomBadge = ({ zoom = 1, visible = true }) => {
  if (!visible) return null;
  return (
    <div
      className="absolute top-7 right-7 z-30 pointer-events-none"
      data-zoom-badge="true"
      aria-live="polite"
    >
      <div
        className="min-w-[2.5rem] h-7 px-2.5 rounded-full flex items-center justify-center
          text-[11px] font-semibold tracking-wide text-white
          bg-white/20 backdrop-blur-md border border-white/25 shadow-sm"
        style={{
          textShadow: "0 1px 2px rgba(0,0,0,0.35)",
        }}
      >
        {updateZoomBadge(zoom)}
      </div>
    </div>
  );
};

export default ZoomBadge;
