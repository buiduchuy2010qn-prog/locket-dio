import { useCallback, useMemo } from 'react'
import { useParticleCanvas, particleCount } from './useParticleCanvas'

export default function SnowEffect({ mobile, lowPerf, reduceMotion, className = '' }) {
  const count = useMemo(
    () => particleCount(55, { mobile, lowPerf, reduceMotion }),
    [mobile, lowPerf, reduceMotion],
  )

  const setupParticle = useCallback((w, h, randomY) => ({
    x: Math.random() * w,
    y: randomY ? Math.random() * h : -10,
    r: 1 + Math.random() * 3.2,
    speed: 0.6 + Math.random() * 1.6,
    drift: (Math.random() - 0.5) * 0.8,
    opacity: 0.35 + Math.random() * 0.5,
    phase: Math.random() * Math.PI * 2,
  }), [])

  const updateParticle = useCallback((p, w, h) => {
    p.phase += 0.02
    p.y += p.speed
    p.x += p.drift + Math.sin(p.phase) * 0.4
    if (p.y > h + 10 || p.x < -10 || p.x > w + 10) Object.assign(p, setupParticle(w, h, false))
  }, [setupParticle])

  const drawParticle = useCallback((ctx, p) => {
    ctx.beginPath()
    ctx.fillStyle = `rgba(255,255,255,${p.opacity})`
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  const canvasRef = useParticleCanvas({
    active: count > 0,
    count,
    setupParticle,
    updateParticle,
    drawParticle,
    clearMode: 'clear',
  })

  if (count === 0) return null
  return <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 w-full h-full ${className}`} aria-hidden />
}
