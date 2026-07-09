import React, { useMemo } from "react";

/**
 * Tuyết rơi mượt — CSS animation, không re-render mỗi frame.
 * pointer-events: none để không chặn bấm UI.
 */
const SnowEffect = ({
  snowflakeCount = 42,
  containerHeight = 900,
  className = "",
}) => {
  const snowflakes = useMemo(() => {
    return Array.from({ length: snowflakeCount }, (_, i) => {
      const size = 2 + (i % 7) * 0.9 + (i % 3) * 0.4;
      return {
        id: i,
        size,
        left: ((i * 37 + 13) % 100) + (i % 5) * 0.3,
        duration: 7 + (i % 9) * 1.1,
        delay: -((i * 1.7) % 12),
        drift: ((i % 11) - 5) * 8,
        opacity: 0.35 + (i % 5) * 0.1,
        blur: size > 5 ? 1.2 : 0.4,
        startY: -((i * 23) % 80) - 10,
      };
    });
  }, [snowflakeCount]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute rounded-full bg-white will-change-transform"
          style={{
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            left: `${flake.left}%`,
            top: `${flake.startY}px`,
            opacity: flake.opacity,
            filter: `blur(${flake.blur}px)`,
            boxShadow:
              flake.size > 4
                ? "0 0 6px rgba(255,255,255,0.55)"
                : "0 0 2px rgba(255,255,255,0.35)",
            animation: `snow-fall ${flake.duration}s linear ${flake.delay}s infinite`,
            ["--drift"]: `${flake.drift}px`,
            ["--fall-distance"]: `${containerHeight + Math.abs(flake.startY) + 40}px`,
          }}
        />
      ))}
    </div>
  );
};

export default SnowEffect;
