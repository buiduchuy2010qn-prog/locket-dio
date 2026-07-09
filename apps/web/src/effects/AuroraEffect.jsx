import { useEffect, useRef } from 'react'

/** Soft animated aurora bands — CSS + light canvas wash */
export default function AuroraEffect({ reduceMotion, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    if (reduceMotion) return undefined
    const el = ref.current
    if (!el) return undefined
    let t = 0
    let raf = 0
    const tick = () => {
      if (document.hidden) {
        raf = requestAnimationFrame(tick)
        return
      }
      t += 0.004
      el.style.setProperty('--ax', `${50 + Math.sin(t) * 12}%`)
      el.style.setProperty('--ay', `${40 + Math.cos(t * 0.7) * 10}%`)
      el.style.setProperty('--bx', `${60 + Math.cos(t * 0.9) * 15}%`)
      el.style.setProperty('--by', `${55 + Math.sin(t * 1.1) * 12}%`)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduceMotion])

  return (
    <div
      ref={ref}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
      style={{
        background: `
          radial-gradient(ellipse 80% 50% at var(--ax, 50%) var(--ay, 40%), rgba(52, 211, 153, 0.28), transparent 55%),
          radial-gradient(ellipse 70% 45% at var(--bx, 60%) var(--by, 55%), rgba(139, 92, 246, 0.25), transparent 50%),
          radial-gradient(ellipse 60% 40% at 30% 70%, rgba(56, 189, 248, 0.18), transparent 50%),
          linear-gradient(180deg, #0b1224 0%, #111827 50%, #0f172a 100%)
        `,
        transition: reduceMotion ? 'none' : 'background 0.3s linear',
      }}
    />
  )
}
