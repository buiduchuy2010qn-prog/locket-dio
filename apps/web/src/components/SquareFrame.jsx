export default function SquareFrame({
  children,
  className = '',
  showSafeGuide = false,
  size = 'full',
  rounded = true,
}) {
  return (
    <div
      className={[
        'relative w-full aspect-square overflow-hidden bg-[#0c1222]',
        rounded ? 'rounded-[1.75rem] sm:rounded-[2rem]' : '',
        'shadow-[0_20px_60px_rgba(12,18,34,0.25)]',
        'ring-1 ring-black/5',
        size === 'md' ? 'max-w-md mx-auto' : '',
        className,
      ].join(' ')}
    >
      <div className="absolute inset-0 z-0 [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover">
        {children}
      </div>
      {showSafeGuide && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="w-[90%] h-[90%] rounded-2xl border border-dashed border-white/40" />
        </div>
      )}
    </div>
  )
}

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
