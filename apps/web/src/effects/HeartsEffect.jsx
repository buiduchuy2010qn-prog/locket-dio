import { useCallback, useMemo } from 'react'
import { useParticleCanvas, particleCount } from './useParticleCanvas'

export default function HeartsEffect({ mobile, lowPerf, reduceMotion, className = '' }) {
  const count = useMemo(
    () => particleCount(22, { mobile, lowPerf, reduceMotion }),
    [mobile, lowPerf, reduceMotion],
  )

  const setupParticle = useCallback((w, h, randomY) => ({
    x: Math.random() * w,
    y: randomY ? Math.random() * h : h + 20,
    size: 8 + Math.random() * 14,
    speed: 0.4 + Math.random() * 0.9,
    sway: (Math.random() - 0.5) * 0.6,
    phase: Math.random() * Math.PI * 2,
    opacity: 0.25 + Math.random() * 0.4,
    rot: Math.random() * Math.PI,
  }), [])

  const updateParticle = useCallback((p, w, h) => {
    p.phase += 0.02
    p.y -= p.speed
    p.x += Math.sin(p.phase) * p.sway
    p.rot += 0.01
    if (p.y < -30) Object.assign(p, setupParticle(w, h, false))
  }, [setupParticle])

  const drawParticle = useCallback((ctx, p) => {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.scale(p.size / 16, p.size / 16)
    ctx.fillStyle = `rgba(255, 120, 150, ${p.opacity})`
    ctx.beginPath()
    ctx.moveTo(0, 4)
    ctx.bezierCurveTo(-10, -6, -14, 6, 0, 14)
    ctx.bezierCurveTo(14, 6, 10, -6, 0, 4)
    ctx.fill()
    ctx.restore()
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
