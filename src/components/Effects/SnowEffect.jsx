import React, { useEffect, useRef } from "react";

/**
 * Tuyết rơi kiểu ❄ — spawn liên tục giống demo HTML user.
 * pointer-events: none, tự remove sau khi rơi xong.
 */
const SNOW_CHARS = ["❄", "❅", "❆", "·"];

const SnowEffect = ({
  /** ms giữa mỗi bông (nhỏ = dày hơn). Mặc định ~mẫu HTML 80ms */
  intervalMs = 90,
  /** tối đa bông trên màn (tránh lag mobile) */
  maxFlakes = 60,
  className = "",
  /** giữ API cũ (caption widgets) — không còn dùng dots */
  snowflakeCount,
  containerHeight,
}) => {
  const layerRef = useRef(null);
  const countRef = useRef(0);

  // API cũ: snowflakeCount cao → rơi dày hơn
  const spawnEvery =
    typeof snowflakeCount === "number" && snowflakeCount > 0
      ? Math.max(50, Math.min(200, Math.round(5000 / snowflakeCount)))
      : intervalMs;

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;

    let alive = true;
    let timer = null;

    const spawn = () => {
      if (!alive || !layer) return;
      if (countRef.current >= maxFlakes) return;

      const el = document.createElement("span");
      el.className = "snowflake-emoji";
      el.textContent =
        SNOW_CHARS[Math.floor(Math.random() * SNOW_CHARS.length)];
      el.setAttribute("aria-hidden", "true");

      const size = 10 + Math.random() * 20;
      const duration = 3 + Math.random() * 5;
      const left = Math.random() * 100;
      const opacity = 0.4 + Math.random() * 0.55;
      const drift = (Math.random() - 0.5) * 80;

      el.style.left = `${left}%`;
      el.style.fontSize = `${size}px`;
      el.style.opacity = String(opacity);
      el.style.animationDuration = `${duration}s`;
      el.style.setProperty("--drift", `${drift}px`);

      layer.appendChild(el);
      countRef.current += 1;

      const life = Math.ceil(duration * 1000) + 400;
      window.setTimeout(() => {
        el.remove();
        countRef.current = Math.max(0, countRef.current - 1);
      }, life);
    };

    // Seed vài bông ngay khi mount
    for (let i = 0; i < 8; i++) {
      window.setTimeout(spawn, i * 40);
    }

    timer = window.setInterval(spawn, spawnEvery);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (layer) layer.innerHTML = "";
      countRef.current = 0;
    };
  }, [spawnEvery, maxFlakes]);

  return (
    <div
      ref={layerRef}
      className={`snow-layer pointer-events-none fixed inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
      style={{ zIndex: 9999 }}
    />
  );
};

export default SnowEffect;
