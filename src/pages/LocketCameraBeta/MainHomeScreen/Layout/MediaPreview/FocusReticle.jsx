import React, { useEffect, useState } from "react";

/**
 * Camera-style focus square at tap point (percent coords inside frame).
 * Auto-hides after ~1.1s; re-mount key from parent to restart animation.
 */
export default function FocusReticle({ x, y, show, success = true }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show || x == null || y == null) {
      setVisible(false);
      return undefined;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1100);
    return () => clearTimeout(t);
  }, [show, x, y]);

  if (!visible || x == null || y == null) return null;

  const color = success ? "rgba(250, 250, 250, 0.95)" : "rgba(255, 220, 100, 0.9)";

  return (
    <div
      className="absolute z-40 pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
      }}
      aria-hidden
    >
      <div
        className="camera-focus-reticle"
        style={{
          width: 72,
          height: 72,
          border: `2px solid ${color}`,
          borderRadius: 6,
          boxShadow: `0 0 0 1px rgba(0,0,0,0.25), 0 0 12px rgba(255,255,255,0.25)`,
        }}
      >
        {/* corner ticks */}
        <span className="cam-focus-corner cam-focus-tl" style={{ borderColor: color }} />
        <span className="cam-focus-corner cam-focus-tr" style={{ borderColor: color }} />
        <span className="cam-focus-corner cam-focus-bl" style={{ borderColor: color }} />
        <span className="cam-focus-corner cam-focus-br" style={{ borderColor: color }} />
      </div>
      <style>{`
        .camera-focus-reticle {
          position: relative;
          animation: cam-focus-pulse 0.95s ease-out forwards;
        }
        .cam-focus-corner {
          position: absolute;
          width: 14px;
          height: 14px;
          border-style: solid;
          border-width: 0;
        }
        .cam-focus-tl { top: -1px; left: -1px; border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 4px; }
        .cam-focus-tr { top: -1px; right: -1px; border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 4px; }
        .cam-focus-bl { bottom: -1px; left: -1px; border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 4px; }
        .cam-focus-br { bottom: -1px; right: -1px; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 4px; }
        @keyframes cam-focus-pulse {
          0% { transform: scale(1.35); opacity: 0.35; }
          35% { transform: scale(1); opacity: 1; }
          75% { transform: scale(0.92); opacity: 1; }
          100% { transform: scale(0.88); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
