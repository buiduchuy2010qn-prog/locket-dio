import { useCallback, useEffect, useRef, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import SquareFrame from './SquareFrame'
import { clampPan, loadImage } from '../utils/squareCrop'

/**
 * Pan + zoom editor inside a perfect square frame (1:1).
 */
export default function SquareCropEditor({ src, onChange, className = '' }) {
  const frameRef = useRef(null)
  const [framePx, setFramePx] = useState(320)
  const [natural, setNatural] = useState({ w: 1, h: 1 })
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef(null)

  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      if (w > 0) setFramePx(w)
    })
    ro.observe(el)
    setFramePx(el.clientWidth || 320)
    return () => ro.disconnect()
  }, [src])

  useEffect(() => {
    let cancelled = false
    loadImage(src).then((img) => {
      if (cancelled) return
      setNatural({ w: img.naturalWidth, h: img.naturalHeight })
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [src])

  useEffect(() => {
    onChange?.({
      zoom,
      offsetX: offset.x,
      offsetY: offset.y,
      naturalWidth: natural.w,
      naturalHeight: natural.h,
    })
  }, [zoom, offset, natural, onChange])

  const applyPan = useCallback((nx, ny, z = zoom) => {
    const c = clampPan(nx, ny, natural.w, natural.h, framePx, z)
    setOffset({ x: c.offsetX, y: c.offsetY })
  }, [natural, zoom, framePx])

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    applyPan(drag.current.ox + dx, drag.current.oy + dy)
  }
  const onPointerUp = () => { drag.current = null }

  const setZoomClamped = (z) => {
    const next = Math.min(3, Math.max(1, Number(z) || 1))
    setZoom(next)
    const c = clampPan(offset.x, offset.y, natural.w, natural.h, framePx, next)
    setOffset({ x: c.offsetX, y: c.offsetY })
  }

  const cover = Math.max(framePx / natural.w, framePx / natural.h) * zoom
  const dw = natural.w * cover
  const dh = natural.h * cover

  return (
    <div className={className}>
      <div
        ref={frameRef}
        className="touch-none select-none cursor-grab active:cursor-grabbing w-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <SquareFrame showSafeGuide>
          <div className="absolute inset-0 overflow-hidden bg-slate-900">
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute max-w-none pointer-events-none"
              style={{
                width: `${dw}px`,
                height: `${dh}px`,
                left: `${(framePx - dw) / 2 + offset.x}px`,
                top: `${(framePx - dh) / 2 + offset.y}px`,
              }}
            />
          </div>
        </SquareFrame>
      </div>

      <div className="mt-3 flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={() => setZoomClamped(zoom - 0.15)}
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-white/80 dark:bg-slate-800 shrink-0"
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoomClamped(e.target.value)}
          className="flex-1 accent-amber-500"
        />
        <button
          type="button"
          onClick={() => setZoomClamped(zoom + 0.15)}
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-white/80 dark:bg-slate-800 shrink-0"
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }) }}
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-white/80 dark:bg-slate-800 shrink-0"
          title="Reset"
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <p className="text-[11px] text-center text-slate-500 mt-1.5">
        Kéo để di chuyển · Zoom để phóng · Khung vuông 1:1
      </p>
    </div>
  )
}
