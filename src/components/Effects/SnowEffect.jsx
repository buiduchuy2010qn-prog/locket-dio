import React, { useEffect, useRef } from "react";
import "./snow.css";

/**
 * Tuyết — lite mode (Android): ít bông, không filter/glow nặng, setInterval thay rAF.
 */
const FLAKE_POOL = [
  { char: "❄", kind: "" },
  { char: "❅", kind: "" },
  { char: "·", kind: "" },
  { char: "✦", kind: "is-spark" },
  { char: "♥", kind: "is-heart" },
];

const SnowEffect = ({
  intervalMs = 90,
  maxFlakes = 60,
  className = "",
  snowflakeCount,
  containerHeight,
  pinkMode = false,
  /** Android/low-end: giảm DOM churn + CSS nặng */
  lite = false,
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
    let intervalId = null;

    const fallDistance =
      typeof containerHeight === "number" && containerHeight > 0
        ? `${containerHeight + 40}px`
        : "110vh";

    const pickFlake = () => {
      if (lite) {
        // Lite: chỉ ❄ và ·
        return Math.random() < 0.7
          ? FLAKE_POOL[0]
          : FLAKE_POOL[2];
      }
      if (pinkMode) {
        const r = Math.random();
        if (r < 0.15) return FLAKE_POOL[4];
        if (r < 0.28) return FLAKE_POOL[3];
        return FLAKE_POOL[Math.floor(Math.random() * 3)];
      }
      return FLAKE_POOL[Math.floor(Math.random() * 3)];
    };

    const spawn = () => {
      if (!alive || !layer) return;
      if (countRef.current >= maxFlakes) return;

      const flake = pickFlake();
      const el = document.createElement("span");
      el.className = `snowflake-emoji ${flake.kind}`.trim();
      el.textContent = flake.char;
      el.setAttribute("aria-hidden", "true");

      const size = lite
        ? 10 + Math.random() * 10
        : 11 + Math.random() * 16;
      const duration = lite ? 5 + Math.random() * 4 : 4.5 + Math.random() * 5;
      const left = Math.random() * 100;
      const opacity = lite ? 0.35 + Math.random() * 0.35 : 0.45 + Math.random() * 0.5;
      const drift = (Math.random() - 0.5) * (lite ? 40 : 90);
      const spin = lite
        ? (Math.random() > 0.5 ? 1 : -1) * 90
        : (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 400);

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

    const seed = Math.min(lite ? 3 : 6, maxFlakes);
    for (let i = 0; i < seed; i++) {
      window.setTimeout(spawn, i * (lite ? 150 : 90));
    }

    if (lite) {
      // setInterval nhẹ hơn rAF liên tục trên Android
      intervalId = window.setInterval(() => {
        if (!alive || document.hidden) return;
        spawn();
      }, spawnEvery);
    } else {
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
    }

    return () => {
      alive = false;
      if (timer) window.cancelAnimationFrame(timer);
      if (intervalId) window.clearInterval(intervalId);
      if (layer) layer.innerHTML = "";
      countRef.current = 0;
    };
  }, [spawnEvery, maxFlakes, containerHeight, pinkMode, lite]);

  return (
    <div
      ref={layerRef}
      className={`snow-layer ${className}`.trim()}
      aria-hidden="true"
    />
  );
};

export default SnowEffect;
