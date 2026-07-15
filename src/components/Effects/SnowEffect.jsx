import React, { useEffect, useRef } from "react";
import "./snow.css";

/**
 * Tuyết rơi — CSS transform GPU.
 * premium (pinksnow): multi-depth layers, denser, brighter.
 * lite (Android): ít bông, setInterval, glow nhẹ.
 */
const FLAKE_POOL = [
  { char: "❄", kind: "" },
  { char: "❅", kind: "" },
  { char: "❆", kind: "" },
  { char: "·", kind: "" },
  { char: "✦", kind: "is-spark" },
  { char: "✧", kind: "is-spark" },
  { char: "♥", kind: "is-heart" },
];

/** Depth profiles: size / duration / opacity / drift scale */
const DEPTH = {
  back: {
    cls: "flake-back",
    size: [8, 12],
    duration: [8, 12],
    opacity: [0.35, 0.55],
    drift: 50,
    weight: 0.4,
  },
  mid: {
    cls: "flake-mid",
    size: [12, 18],
    duration: [5.5, 8.5],
    opacity: [0.55, 0.85],
    drift: 90,
    weight: 0.4,
  },
  fore: {
    cls: "flake-fore",
    size: [16, 24],
    duration: [3.8, 6],
    opacity: [0.75, 0.98],
    drift: 120,
    weight: 0.2,
  },
};

function pickDepth(premium) {
  if (!premium) {
    // Standard: mostly mid, some back
    return Math.random() < 0.35 ? DEPTH.back : DEPTH.mid;
  }
  const r = Math.random();
  if (r < DEPTH.back.weight) return DEPTH.back;
  if (r < DEPTH.back.weight + DEPTH.mid.weight) return DEPTH.mid;
  return DEPTH.fore;
}

function randRange([a, b]) {
  return a + Math.random() * (b - a);
}

const SnowEffect = ({
  intervalMs = 90,
  maxFlakes = 60,
  className = "",
  snowflakeCount,
  containerHeight,
  pinkMode = false,
  /** pinksnow only — multi-layer + denser */
  premium = false,
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
        : "115vh";

    const pickFlake = () => {
      if (lite) {
        return Math.random() < 0.75 ? FLAKE_POOL[0] : FLAKE_POOL[3];
      }
      if (premium || pinkMode) {
        const r = Math.random();
        // Premium pinksnow: more variety, still mostly snow glyphs
        if (premium) {
          if (r < 0.12) return FLAKE_POOL[6]; // ♥
          if (r < 0.28) return FLAKE_POOL[4 + (Math.random() < 0.5 ? 0 : 1)]; // spark
          return FLAKE_POOL[Math.floor(Math.random() * 4)]; // snow + ·
        }
        if (r < 0.15) return FLAKE_POOL[6];
        if (r < 0.28) return FLAKE_POOL[4];
        return FLAKE_POOL[Math.floor(Math.random() * 3)];
      }
      return FLAKE_POOL[Math.floor(Math.random() * 3)];
    };

    const spawn = () => {
      if (!alive || !layer) return;
      if (countRef.current >= maxFlakes) return;

      const flake = pickFlake();
      const depth = pickDepth(premium && !lite);
      const el = document.createElement("span");
      el.className =
        `snowflake-emoji ${flake.kind} ${depth.cls}`.trim();
      el.textContent = flake.char;
      el.setAttribute("aria-hidden", "true");

      let size;
      let duration;
      let opacity;
      let driftScale = depth.drift;

      if (lite) {
        size = 11 + Math.random() * 11;
        duration = 5 + Math.random() * 4;
        opacity = 0.45 + Math.random() * 0.4;
        driftScale = 45;
      } else if (premium) {
        size = randRange(depth.size);
        duration = randRange(depth.duration);
        opacity = randRange(depth.opacity);
      } else {
        size = 11 + Math.random() * 16;
        duration = 4.5 + Math.random() * 5;
        opacity = 0.45 + Math.random() * 0.5;
      }

      const left = Math.random() * 100;
      const drift = (Math.random() - 0.5) * 2 * driftScale;
      const spin = lite
        ? (Math.random() > 0.5 ? 1 : -1) * 90
        : (Math.random() > 0.5 ? 1 : -1) *
          (premium ? 160 + Math.random() * 480 : 120 + Math.random() * 400);
      const scale =
        premium && depth.cls === "flake-fore"
          ? 1 + Math.random() * 0.15
          : premium && depth.cls === "flake-back"
            ? 0.75 + Math.random() * 0.15
            : 1;

      el.style.left = `${left}%`;
      el.style.fontSize = `${size}px`;
      el.style.opacity = String(opacity);
      el.style.setProperty("--flake-opacity", String(opacity));
      el.style.setProperty("--drift", `${drift.toFixed(1)}px`);
      el.style.setProperty("--fall-distance", fallDistance);
      el.style.setProperty("--spin", `${spin}deg`);
      el.style.setProperty("--flake-scale", String(scale.toFixed(3)));
      el.style.animationDuration = `${duration.toFixed(2)}s`;
      // Stagger start so rain feels continuous, not pulsed
      el.style.animationDelay = lite ? "0s" : `${(-Math.random() * duration).toFixed(2)}s`;

      if (!alive || !layer.isConnected) return;
      try {
        layer.appendChild(el);
      } catch {
        return;
      }
      countRef.current += 1;

      const life = Math.ceil(duration * 1000) + 250;
      window.setTimeout(() => {
        if (!alive) return;
        try {
          if (el.parentNode === layer) layer.removeChild(el);
        } catch {
          /* already detached */
        }
        countRef.current = Math.max(0, countRef.current - 1);
      }, life);
    };

    // Seed more flakes for premium pinksnow so first paint already feels snowy
    const seed = Math.min(
      lite ? 4 : premium ? 14 : 6,
      maxFlakes,
    );
    for (let i = 0; i < seed; i++) {
      window.setTimeout(spawn, i * (lite ? 120 : premium ? 45 : 90));
    }

    if (lite) {
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
          // Premium: occasional double-spawn for density without shorter interval
          spawn();
          if (premium && countRef.current < maxFlakes * 0.85 && Math.random() < 0.35) {
            spawn();
          }
        }
        timer = window.requestAnimationFrame(tick);
      };
      timer = window.requestAnimationFrame(tick);
    }

    return () => {
      alive = false;
      if (timer) window.cancelAnimationFrame(timer);
      if (intervalId) window.clearInterval(intervalId);
      try {
        if (layer?.isConnected) {
          while (layer.firstChild) layer.removeChild(layer.firstChild);
        }
      } catch {
        /* ignore */
      }
      countRef.current = 0;
    };
  }, [spawnEvery, maxFlakes, containerHeight, pinkMode, premium, lite]);

  return (
    <div
      ref={layerRef}
      className={`snow-layer ${className}`.trim()}
      aria-hidden="true"
    />
  );
};

export default SnowEffect;
