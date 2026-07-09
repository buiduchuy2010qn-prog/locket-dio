import { Crown } from 'lucide-react'
import { BADGE_STYLES } from '../data/constants'

export function GoldPill({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-amber-900 bg-gradient-to-r from-amber-200 to-yellow-300 ${className}`}>
      <Crown size={10} /> Gold
    </span>
  )
}

export function LockGold({ label = 'Gold', onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/80 text-amber-300 border border-amber-400/40"
    >
      🔒 {label}
    </button>
  )
}

export function BadgePreview({ styleId }) {
  const b = BADGE_STYLES.find((x) => x.id === styleId) || BADGE_STYLES[0]
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full gold-gradient text-white text-xs font-bold shadow-[var(--shadow-gold)]">
      <span>{b.icon}</span> {b.label}
    </span>
  )
}
