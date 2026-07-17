import React, { useEffect, useRef } from "react";
import "./snow.css";

/**
 * Canvas snow — single fixed canvas, particle pool, rAF.
 * No DOM flakes / emoji. Does not capture pointer events.
 * Never draws into camera MediaStream or capture canvas.
 */
const SnowEffect = ({
  maxFlakes = 28,
  pinkMode = false,
  className = "",
  /** static flakes only (reduced-motion) */
  staticOnly = false,
}) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let alive = true;
    const particles = particlesRef.current;

    const cap = Math.max(0, Math.min(60, Number(maxFlakes) || 0));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const colorFor = () => {
      if (!pinkMode) return "rgba(255,255,255,";
      const r = Math.random();
      if (r < 0.55) return "rgba(255,255,255,";
      if (r < 0.85) return "rgba(255,240,248,";
      return "rgba(255,210,230,";
    };

    const resetParticle = (p, spawnTop) => {
      const { w, h } = sizeRef.current;
      p.x = Math.random() * w;
      p.y = spawnTop ? -4 - Math.random() * 40 : Math.random() * h;
      p.r = 1.5 + Math.random() * 3.5;
      p.speed = 0.35 + Math.random() * 1.15;
      p.drift = (Math.random() - 0.5) * 0.45;
      p.phase = Math.random() * Math.PI * 2;
      p.op = 0.35 + Math.random() * 0.5;
      p.color = colorFor();
      p.kind = Math.random() < 0.72 ? 0 : Math.random() < 0.5 ? 1 : 2; // 0 circle, 1 soft star, 2 cross
    };

    // Build / trim pool (reuse — no alloc in loop)
    while (particles.length < cap) {
      const p = {};
      resetParticle(p, false);
      particles.push(p);
    }
    if (particles.length > cap) particles.length = cap;

    resize();

    const drawFlake = (p) => {
      ctx.globalAlpha = p.op;
      ctx.fillStyle = p.color + "1)";
      if (p.kind === 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (p.kind === 1) {
        // soft 4-point spark
        const s = p.r * 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s);
        ctx.lineTo(p.x + s * 0.35, p.y);
        ctx.lineTo(p.x, p.y + s);
        ctx.lineTo(p.x - s * 0.35, p.y);
        ctx.closePath();
        ctx.fill();
        return;
      }
      // simple cross snow
      const s = p.r * 1.2;
      ctx.strokeStyle = p.color + "1)";
      ctx.lineWidth = Math.max(0.8, p.r * 0.35);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x - s, p.y);
      ctx.lineTo(p.x + s, p.y);
      ctx.moveTo(p.x, p.y - s);
      ctx.lineTo(p.x, p.y + s);
      ctx.stroke();
    };

    const paintStatic = () => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        drawFlake(particles[i]);
      }
      ctx.globalAlpha = 1;
    };

    let last = 0;
    const tick = (now) => {
      if (!alive) return;
      if (document.hidden) {
        rafRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
      if (staticOnly) return;

      const dt = Math.min(32, now - last || 16);
      last = now;
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.phase += dt * 0.0012;
        p.y += p.speed * (dt * 0.06);
        p.x += p.drift + Math.sin(p.phase) * 0.15;
        if (p.y > h + 8 || p.x < -12 || p.x > w + 12) {
          resetParticle(p, true);
        }
        drawFlake(p);
      }
      ctx.globalAlpha = 1;
    };

    const onVis = () => {
      if (document.hidden) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        return;
      }
      if (!staticOnly && !rafRef.current) {
        last = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      } else if (staticOnly) {
        paintStatic();
      }
    };

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVis);

    if (staticOnly) {
      paintStatic();
    } else {
      last = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch {
        /* ignore */
      }
    };
  }, [maxFlakes, pinkMode, staticOnly]);

  return (
    <canvas
      ref={canvasRef}
      className={`snow-layer snow-layer--canvas ${className}`.trim()}
      aria-hidden="true"
    />
  );
};

export default SnowEffect;
