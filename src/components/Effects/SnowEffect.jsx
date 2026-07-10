import React, { useEffect, useRef } from "react";
import "./snow.css";

/**
 * Tuyết rơi kiểu ❄ — spawn liên tục.
 * pointer-events: none, tự remove sau khi rơi xong.
 */
const SNOW_CHARS = ["❄", "❅", "❆", "·"];

const SnowEffect = ({
  /** ms giữa mỗi bông (nhỏ = dày hơn) */
  intervalMs = 90,
  /** tối đa bông trên màn (tránh lag mobile) */
  maxFlakes = 60,
  className = "",
  /** giữ API cũ (caption widgets) */
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

    const fallDistance =
      typeof containerHeight === "number" && containerHeight > 0
        ? `${containerHeight + 40}px`
        : "110vh";

    const spawn = () => {
      if (!alive || !layer) return;
      if (countRef.current >= maxFlakes) return;

      const el = document.createElement("span");
      el.className = "snowflake-emoji";
      el.textContent =
        SNOW_CHARS[Math.floor(Math.random() * SNOW_CHARS.length)];
      el.setAttribute("aria-hidden", "true");

      const size = 10 + Math.random() * 18;
      const duration = 4 + Math.random() * 5; // 4–9s rơi
      const left = Math.random() * 100;
      const opacity = 0.45 + Math.random() * 0.5;
      const drift = (Math.random() - 0.5) * 90;
      const spin = (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360);

      el.style.left = `${left}%`;
      el.style.fontSize = `${size}px`;
      el.style.opacity = String(opacity);
      el.style.setProperty("--flake-opacity", String(opacity));
      el.style.setProperty("--drift", `${drift}px`);
      el.style.setProperty("--fall-distance", fallDistance);
      el.style.setProperty("--spin", `${spin}deg`);
      el.style.animationDuration = `${duration}s`;

      layer.appendChild(el);
      countRef.current += 1;

      const life = Math.ceil(duration * 1000) + 200;
      window.setTimeout(() => {
        el.remove();
        countRef.current = Math.max(0, countRef.current - 1);
      }, life);
    };

    // Seed nhẹ — tránh spawn ồ ạt làm jank camera
    const seed = Math.min(6, maxFlakes);
    for (let i = 0; i < seed; i++) {
      window.setTimeout(spawn, i * 100);
    }

    let last = 0;
    const tick = (now) => {
      if (!alive) return;
      if (!document.hidden && now - last >= spawnEvery) {
        last = now;
        spawn();
      }
      timer = window.requestAnimationFrame(tick);
    };
    timer = window.requestAnimationFrame(tick);

    return () => {
      alive = false;
      if (timer) window.cancelAnimationFrame(timer);
      if (layer) layer.innerHTML = "";
      countRef.current = 0;
    };
  }, [spawnEvery, maxFlakes, containerHeight]);

  return (
    <div
      ref={layerRef}
      className={`snow-layer ${className}`.trim()}
      aria-hidden="true"
    />
  );
};

export default SnowEffect;
