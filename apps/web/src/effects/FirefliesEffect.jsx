import { useCallback, useMemo } from 'react'
import { useParticleCanvas, particleCount } from './useParticleCanvas'

export default function FirefliesEffect({ mobile, lowPerf, reduceMotion, className = '' }) {
  const count = useMemo(
    () => particleCount(35, { mobile, lowPerf, reduceMotion }),
    [mobile, lowPerf, reduceMotion],
  )

  const setupParticle = useCallback((w, h) => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    tw: Math.random() * Math.PI * 2,
    r: 1.5 + Math.random() * 2,
  }), [])

  const updateParticle = useCallback((p, w, h) => {
    p.tw += 0.04
    p.x += p.vx + Math.sin(p.tw) * 0.3
    p.y += p.vy + Math.cos(p.tw * 0.8) * 0.25
    if (p.x < 0 || p.x > w) p.vx *= -1
    if (p.y < 0 || p.y > h) p.vy *= -1
  }, [])

  const drawParticle = useCallback((ctx, p) => {
    const o = 0.25 + Math.abs(Math.sin(p.tw)) * 0.65
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6)
    g.addColorStop(0, `rgba(200, 255, 150, ${o})`)
    g.addColorStop(0.4, `rgba(180, 255, 100, ${o * 0.4})`)
    g.addColorStop(1, 'rgba(100, 200, 50, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2)
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
