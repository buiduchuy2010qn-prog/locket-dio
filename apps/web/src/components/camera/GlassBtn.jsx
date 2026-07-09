export default function GlassBtn({
  children,
  onClick,
  className = '',
  size = 'md',
  variant = 'dark',
  label,
  active,
  disabled,
}) {
  const sizes = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
    xl: 'w-[4.5rem] h-[4.5rem]',
  }
  const variants = {
    dark: 'glass-dark text-white hover:bg-white/15',
    light: 'bg-white/95 text-slate-800 border border-slate-200/80 shadow-[var(--shadow-soft)] hover:shadow-md',
    solid: 'bg-white text-slate-900 border border-white shadow-xl',
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center rounded-full press disabled:opacity-40',
        sizes[size] || sizes.md,
        variants[variant] || variants.dark,
        active ? 'ring-2 ring-indigo-400' : '',
        className,
      ].join(' ')}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}

export function FriendsPill({ text = 'Tất cả bạn bè', onClick, variant = 'dark' }) {
  const v =
    variant === 'light'
      ? 'bg-white text-slate-800 border-slate-200 shadow-md'
      : 'glass-dark text-white'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-full border text-[13px] font-semibold press flex items-center gap-1.5 max-w-[220px] ${v}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
      <span className="truncate">{text}</span>
      <span className="opacity-50 text-[10px]">▾</span>
    </button>
  )
}
