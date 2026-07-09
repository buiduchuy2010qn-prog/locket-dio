export default function GlassBtn({
  children,
  onClick,
  className = '',
  size = 'md', // sm | md | lg | xl
  variant = 'dark', // dark (mobile) | light (desktop)
  label,
  active,
  disabled,
}) {
  const sizes = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-[4.5rem] h-[4.5rem] text-xl',
  }
  const variants = {
    dark: 'bg-white/15 text-white border-white/20 hover:bg-white/25 backdrop-blur-md shadow-lg',
    light: 'bg-white/90 text-slate-800 border-slate-200/80 hover:bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur-md',
    solid: 'bg-white text-slate-900 border-white shadow-xl',
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex flex-col items-center justify-center rounded-full border transition active:scale-90 disabled:opacity-40',
        sizes[size] || sizes.md,
        variants[variant] || variants.dark,
        active ? 'ring-2 ring-amber-400' : '',
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
      ? 'bg-white/90 text-slate-800 border-slate-200 shadow-md'
      : 'bg-white/15 text-white border-white/25 shadow-lg'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 rounded-full border backdrop-blur-md text-sm font-semibold active:scale-95 transition flex items-center gap-1.5 max-w-[200px] truncate ${v}`}
    >
      <span className="truncate">{text}</span>
      <span className="opacity-70 text-xs">▾</span>
    </button>
  )
}
