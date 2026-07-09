import { useCallback, useMemo } from 'react'
import { useParticleCanvas, particleCount } from './useParticleCanvas'

export default function StarsEffect({ mobile, lowPerf, reduceMotion, className = '' }) {
  const count = useMemo(
    () => particleCount(70, { mobile, lowPerf, reduceMotion }),
    [mobile, lowPerf, reduceMotion],
  )

  const setupParticle = useCallback((w, h) => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 0.4 + Math.random() * 1.6,
    tw: Math.random() * Math.PI * 2,
    speed: 0.015 + Math.random() * 0.03,
  }), [])

  const updateParticle = useCallback((p) => {
    p.tw += p.speed
  }, [])

  const drawParticle = useCallback((ctx, p) => {
    const o = 0.2 + Math.abs(Math.sin(p.tw)) * 0.8
    ctx.beginPath()
    ctx.fillStyle = `rgba(230, 235, 255, ${o})`
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
