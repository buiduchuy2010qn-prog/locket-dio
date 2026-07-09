export default function Logo({ size = 'md', showWord = true, className = '' }) {
  const s = size === 'lg' ? 'w-12 h-12 text-xl' : size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base'
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${s} rounded-2xl gold-gradient flex items-center justify-center shadow-[var(--shadow-gold)] shrink-0`}>
        <span className="text-white font-extrabold tracking-tight">L</span>
      </div>
      {showWord && (
        <div className="leading-tight">
          <div className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
            Locket<span className="gold-text"> Dio</span>
          </div>
          {size === 'lg' && <p className="text-xs text-slate-500">Private moments with friends</p>}
        </div>
      )}
    </div>
  )
}
