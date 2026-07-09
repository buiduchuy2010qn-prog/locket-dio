import { useCallback, useMemo } from 'react'
import { useParticleCanvas, particleCount } from './useParticleCanvas'

export default function SparkleEffect({ mobile, lowPerf, reduceMotion, className = '' }) {
  const count = useMemo(
    () => particleCount(40, { mobile, lowPerf, reduceMotion }),
    [mobile, lowPerf, reduceMotion],
  )

  const setupParticle = useCallback((w, h) => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 0.5 + Math.random() * 2,
    tw: Math.random() * Math.PI * 2,
    speed: 0.02 + Math.random() * 0.04,
    opacity: 0,
    gold: Math.random() > 0.3,
  }), [])

  const updateParticle = useCallback((p, w, h) => {
    p.tw += p.speed
    p.opacity = 0.15 + Math.abs(Math.sin(p.tw)) * 0.75
    p.y -= 0.15
    if (p.y < -5 || p.tw > Math.PI * 8) Object.assign(p, setupParticle(w, h), { y: h + 5 })
  }, [setupParticle])

  const drawParticle = useCallback((ctx, p) => {
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4)
    if (p.gold) {
      g.addColorStop(0, `rgba(255, 220, 120, ${p.opacity})`)
      g.addColorStop(1, 'rgba(255, 200, 80, 0)')
    } else {
      g.addColorStop(0, `rgba(200, 210, 255, ${p.opacity})`)
      g.addColorStop(1, 'rgba(150, 170, 255, 0)')
    }
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2)
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
