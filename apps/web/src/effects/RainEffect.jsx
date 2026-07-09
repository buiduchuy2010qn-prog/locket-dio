import { useCallback, useMemo } from 'react'
import { useParticleCanvas, particleCount } from './useParticleCanvas'

export default function RainEffect({ intensity = 'soft', mobile, lowPerf, reduceMotion, className = '' }) {
  const base = intensity === 'heavy' ? 90 : 45
  const count = useMemo(
    () => particleCount(base, { mobile, lowPerf, reduceMotion }),
    [base, mobile, lowPerf, reduceMotion],
  )

  const setupParticle = useCallback((w, h, randomY) => {
    const heavy = intensity === 'heavy'
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -20 - Math.random() * 40,
      len: heavy ? 12 + Math.random() * 18 : 8 + Math.random() * 12,
      speed: heavy ? 6 + Math.random() * 8 : 3.5 + Math.random() * 4.5,
      opacity: 0.12 + Math.random() * (heavy ? 0.35 : 0.28),
      width: heavy ? 1 + Math.random() * 1.2 : 0.6 + Math.random() * 0.9,
      glow: Math.random() > 0.92,
    }
  }, [intensity])

  const updateParticle = useCallback((p, w, h) => {
    p.y += p.speed
    p.x += p.speed * 0.08 // slight diagonal
    if (p.y > h + 20) {
      Object.assign(p, setupParticle(w, h, false))
    }
  }, [setupParticle])

  const drawParticle = useCallback((ctx, p) => {
    ctx.beginPath()
    ctx.strokeStyle = p.glow
      ? `rgba(180, 210, 255, ${p.opacity + 0.15})`
      : `rgba(200, 220, 255, ${p.opacity})`
    ctx.lineWidth = p.width
    ctx.lineCap = 'round'
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x - p.len * 0.15, p.y + p.len)
    ctx.stroke()
    if (p.glow) {
      ctx.beginPath()
      ctx.fillStyle = `rgba(160, 200, 255, ${p.opacity * 0.35})`
      ctx.arc(p.x, p.y + p.len, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
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
  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
      aria-hidden
    />
  )
}
