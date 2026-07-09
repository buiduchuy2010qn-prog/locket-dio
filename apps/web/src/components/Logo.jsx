export default function Logo({ size = 'md', showWord = true, className = '', light = false }) {
  const box =
    size === 'lg' ? 'w-14 h-14 text-2xl' : size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base'
  const word = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg'
  const ink = light ? 'text-white' : 'text-slate-900 dark:text-white'

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`${box} rounded-[1.15rem] dio-gradient flex items-center justify-center shadow-[var(--shadow-dio)] shrink-0 relative overflow-hidden`}
      >
        <span className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_30%_20%,white,transparent_55%)]" />
        <span className="relative text-white font-display font-extrabold tracking-tighter">D</span>
      </div>
      {showWord && (
        <div className="leading-none">
          <div className={`font-display font-extrabold tracking-tight ${word} ${ink}`}>
            Locket<span className="dio-text"> Dio</span>
          </div>
          {size === 'lg' && (
            <p className={`mt-1 text-xs font-medium ${light ? 'text-white/60' : 'text-slate-500'}`}>
              Moments · close friends
            </p>
          )}
        </div>
      )}
    </div>
  )
}
