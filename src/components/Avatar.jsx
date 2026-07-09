import { BADGE_STYLES, PROFILE_FRAMES } from '../data/constants'

export default function Avatar({ user, size = 'md', showBadge = true, className = '' }) {
  const sizes = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  }
  const frame = PROFILE_FRAMES.find((f) => f.id === (user?.profileFrame || 'none'))
  const badge = BADGE_STYLES.find((b) => b.id === (user?.badgeStyle || 'gold-star'))
  const show = showBadge && user?.isGold && user?.badgeVisible !== false

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <img
        src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=guest`}
        alt={user?.displayName || 'avatar'}
        className={`${sizes[size] || sizes.md} rounded-full object-cover bg-slate-100 ${frame?.ring || ''} ${
          user?.isGold ? 'ring-offset-white dark:ring-offset-slate-900' : ''
        }`}
      />
      {show && (
        <span
          className="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none bg-white dark:bg-slate-900 rounded-full p-0.5 shadow"
          title={badge?.name}
        >
          {badge?.icon || '⭐'}
        </span>
      )}
    </div>
  )
}
