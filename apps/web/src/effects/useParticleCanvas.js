import { useEffect, useRef } from 'react'

/**
 * Shared canvas loop: particles, pause on hidden tab, DPR-aware, reduced counts.
 */
export function useParticleCanvas({
  active,
  count,
  setupParticle,
  updateParticle,
  drawParticle,
  clearMode = 'fade', // fade | clear
  fadeAlpha = 0.12,
  bgFill = null,
}) {
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const partsRef = useRef([])
  const sizeRef = useRef({ w: 0, h: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) return undefined

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return undefined

    const resize = () => {
      const parent = canvas.parentElement
      const w = parent?.clientWidth || window.innerWidth
      const h = parent?.clientHeight || window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sizeRef.current = { w, h }
      // re-seed if empty
      if (partsRef.current.length === 0) {
        partsRef.current = Array.from({ length: count }, () => setupParticle(w, h, true))
      }
    }

    resize()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(canvas.parentElement || canvas)
    window.addEventListener('resize', resize)

    let running = true
    const loop = () => {
      if (!running) return
      if (document.hidden) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      const { w, h } = sizeRef.current
      if (clearMode === 'clear') {
        ctx.clearRect(0, 0, w, h)
      } else {
        ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`
        // soft trail — use destination-out style via clear + translucent
        ctx.clearRect(0, 0, w, h)
      }
      if (bgFill) {
        ctx.fillStyle = bgFill
        ctx.fillRect(0, 0, w, h)
      }
      const parts = partsRef.current
      for (let i = 0; i < parts.length; i++) {
        updateParticle(parts[i], w, h)
        drawParticle(ctx, parts[i])
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
      ro?.disconnect()
      window.removeEventListener('resize', resize)
      partsRef.current = []
    }
  }, [active, count, setupParticle, updateParticle, drawParticle, clearMode, fadeAlpha, bgFill])

  return canvasRef
}

export function particleCount(base, { mobile, lowPerf, reduceMotion }) {
  if (reduceMotion) return 0
  let n = base
  if (mobile) n = Math.round(n * 0.4)
  if (lowPerf) n = Math.round(n * 0.35)
  return Math.max(0, Math.min(n, mobile ? 40 : 120))
}
