import React, { useEffect, useRef } from "react";
import "./snow.css";

/**
 * Tuyết hồng — ❄ + ✨ + ♥ rơi nhẹ.
 * pointer-events: none, tự remove sau khi rơi xong.
 */
const FLAKE_POOL = [
  { char: "❄", kind: "" },
  { char: "❅", kind: "" },
  { char: "❆", kind: "" },
  { char: "·", kind: "" },
  { char: "✦", kind: "is-spark" },
  { char: "✧", kind: "is-spark" },
  { char: "♥", kind: "is-heart" },
  { char: "♡", kind: "is-heart" },
];

const SnowEffect = ({
  intervalMs = 90,
  maxFlakes = 60,
  className = "",
  snowflakeCount,
  containerHeight,
  /** pink mode: nhiều tim + lấp lánh hơn */
  pinkMode = false,
}) => {
  const layerRef = useRef(null);
  const countRef = useRef(0);

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

    const pickFlake = () => {
      // pink: ~30% heart/spark, còn lại tuyết
      if (pinkMode) {
        const r = Math.random();
        if (r < 0.18) return FLAKE_POOL[6 + Math.floor(Math.random() * 2)]; // hearts
        if (r < 0.32) return FLAKE_POOL[4 + Math.floor(Math.random() * 2)]; // sparks
        return FLAKE_POOL[Math.floor(Math.random() * 4)];
      }
      return FLAKE_POOL[Math.floor(Math.random() * 4)];
    };

    const spawn = () => {
      if (!alive || !layer) return;
      if (countRef.current >= maxFlakes) return;

      const flake = pickFlake();
      const el = document.createElement("span");
      el.className = `snowflake-emoji ${flake.kind}`.trim();
      el.textContent = flake.char;
      el.setAttribute("aria-hidden", "true");

      const isHeart = flake.kind === "is-heart";
      const isSpark = flake.kind === "is-spark";
      const size = isHeart
        ? 8 + Math.random() * 12
        : isSpark
          ? 8 + Math.random() * 10
          : 11 + Math.random() * 18;
      const duration = 4.5 + Math.random() * 5.5;
      const left = Math.random() * 100;
      const opacity = isHeart
        ? 0.55 + Math.random() * 0.4
        : 0.4 + Math.random() * 0.55;
      const drift = (Math.random() - 0.5) * (isHeart ? 60 : 100);
      const spin =
        (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 400);

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

      const life = Math.ceil(duration * 1000) + 250;
      window.setTimeout(() => {
        el.remove();
        countRef.current = Math.max(0, countRef.current - 1);
      }, life);
    };

    const seed = Math.min(8, maxFlakes);
    for (let i = 0; i < seed; i++) {
      window.setTimeout(spawn, i * 90);
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
  }, [spawnEvery, maxFlakes, containerHeight, pinkMode]);

  return (
    <div
      ref={layerRef}
      className={`snow-layer ${className}`.trim()}
      aria-hidden="true"
    />
  );
};

export default SnowEffect;
