/**
 * Perfect 1:1 square frame — camera preview, media display, glass border.
 */
export default function SquareFrame({
  children,
  className = '',
  showSafeGuide = false,
  size = 'full', // full | md
  rounded = true,
}) {
  return (
    <div
      className={[
        'relative w-full aspect-square overflow-hidden bg-slate-900/90',
        rounded ? 'rounded-[1.25rem] sm:rounded-[1.5rem]' : '',
        'shadow-[0_12px_40px_rgba(15,23,42,0.18)]',
        'ring-1 ring-white/40 dark:ring-white/10',
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:border before:border-white/50 before:bg-gradient-to-br before:from-white/15 before:to-transparent before:z-10',
        size === 'md' ? 'max-w-md mx-auto' : '',
        className,
      ].join(' ')}
    >
      {/* media layer */}
      <div className="absolute inset-0 z-0 [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover">
        {children}
      </div>

      {/* safe-area guide (what will be posted) */}
      {showSafeGuide && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="w-[88%] h-[88%] rounded-2xl border-2 border-dashed border-white/55 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]" />
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/45 text-white text-[10px] font-semibold tracking-wide backdrop-blur-sm">
            Safe area · 1:1
          </span>
        </div>
      )}
    </div>
  )
}

/** Square media for feed/gallery — always 1:1 cover */
export function SquareMedia({ src, type = 'image', alt = '', className = '', controls = false }) {
  return (
    <SquareFrame className={className} showSafeGuide={false}>
      {type === 'video' ? (
        <video src={src} className="w-full h-full object-cover" controls={controls} playsInline muted={!controls} loop={!controls} />
      ) : (
        <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" draggable={false} />
      )}
    </SquareFrame>
  )
}
