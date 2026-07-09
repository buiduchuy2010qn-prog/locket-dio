import { useCallback, useMemo } from 'react'
import { useParticleCanvas, particleCount } from './useParticleCanvas'

export default function BubblesEffect({ mobile, lowPerf, reduceMotion, className = '' }) {
  const count = useMemo(
    () => particleCount(28, { mobile, lowPerf, reduceMotion }),
    [mobile, lowPerf, reduceMotion],
  )

  const setupParticle = useCallback((w, h, randomY) => ({
    x: Math.random() * w,
    y: randomY ? Math.random() * h : h + 20,
    r: 4 + Math.random() * 16,
    speed: 0.3 + Math.random() * 0.8,
    sway: (Math.random() - 0.5) * 0.5,
    phase: Math.random() * Math.PI * 2,
    opacity: 0.12 + Math.random() * 0.25,
  }), [])

  const updateParticle = useCallback((p, w, h) => {
    p.phase += 0.015
    p.y -= p.speed
    p.x += Math.sin(p.phase) * p.sway
    if (p.y < -30) Object.assign(p, setupParticle(w, h, false))
  }, [setupParticle])

  const drawParticle = useCallback((ctx, p) => {
    ctx.beginPath()
    ctx.strokeStyle = `rgba(255,255,255,${p.opacity + 0.15})`
    ctx.fillStyle = `rgba(180, 220, 255, ${p.opacity * 0.35})`
    ctx.lineWidth = 1
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // highlight
    ctx.beginPath()
    ctx.fillStyle = `rgba(255,255,255,${p.opacity + 0.2})`
    ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.2, 0, Math.PI * 2)
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
