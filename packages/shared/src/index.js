/** Shared constants & helpers — used by API and web */

export const FREE_FRIEND_LIMIT = 5
export const FREE_VIDEO_MAX_SEC = 5
export const GOLD_VIDEO_MAX_SEC = 30
export const FREE_MAX_UPLOAD_MB = 8
export const GOLD_MAX_UPLOAD_MB = 50

export const BASIC_REACTIONS = ['❤️', '😂', '🔥', '👏', '😍']
export const GOLD_REACTIONS = ['✨', '💯', '🥳', '🥹', '👑', '🌟', '💫', '🎉', '🥰', '⚡']

export const PLANS = {
  monthly: { id: 'monthly', label: 'Monthly', priceCents: 49000, period: 'month' },
  yearly: { id: 'yearly', label: 'Yearly', priceCents: 399000, period: 'year', save: '32%' },
}

export const APP_ICONS = [
  { id: 'classic', name: 'Classic', gradient: 'from-amber-400 to-orange-500', emoji: '📷' },
  { id: 'neon', name: 'Neon', gradient: 'from-fuchsia-500 to-cyan-400', emoji: '✨' },
  { id: 'minimal', name: 'Minimal', gradient: 'from-slate-200 to-slate-400', emoji: '○' },
  { id: 'sunset', name: 'Sunset', gradient: 'from-orange-400 via-rose-400 to-purple-500', emoji: '🌅' },
  { id: 'glass', name: 'Glass', gradient: 'from-white/80 to-sky-200', emoji: '💎' },
  { id: 'black-gold', name: 'Black Gold', gradient: 'from-zinc-900 to-amber-500', emoji: '★' },
]

export const CAMERA_THEMES = [
  { id: 'soft-pink', name: 'Soft Pink', className: 'cam-theme-soft-pink', preview: '#fda4af' },
  { id: 'night-glass', name: 'Night Glass', className: 'cam-theme-night-glass', preview: '#1e1b4b' },
  { id: 'ocean-blue', name: 'Ocean Blue', className: 'cam-theme-ocean-blue', preview: '#38bdf8' },
  { id: 'sunset-glow', name: 'Sunset Glow', className: 'cam-theme-sunset-glow', preview: '#fb923c' },
  { id: 'minimal-white', name: 'Minimal White', className: 'cam-theme-minimal-white', preview: '#f8fafc' },
  { id: 'black-gold', name: 'Black Gold', className: 'cam-theme-black-gold', preview: '#fbbf24' },
]

export const BADGES = [
  { id: 'gold-star', name: 'Gold Star', icon: '⭐', label: 'Gold' },
  { id: 'crown', name: 'Crown', icon: '👑', label: 'Gold' },
  { id: 'sparkle', name: 'Sparkle', icon: '✨', label: 'Gold' },
  { id: 'minimal-gold', name: 'Minimal Gold', icon: '◆', label: 'Gold' },
  { id: 'neon-gold', name: 'Neon Gold', icon: '⚡', label: 'GOLD' },
]

export function isGoldActive(sub) {
  if (!sub) return false
  if (sub.status !== 'ACTIVE' && sub.status !== 'TRIALING') return false
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) return false
  return true
}

export function publicUser(user, extras = {}) {
  if (!user) return null
  const profile = user.profile || {}
  const gold = isGoldActive(user.goldSubscription)
  const custom = user.goldCustomization || {}
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    emailVerified: !!user.emailVerifiedAt,
    displayName: profile.displayName || user.username,
    bio: profile.bio || '',
    avatar: profile.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}`,
    darkMode: !!profile.darkMode,
    showActivity: profile.showActivity !== false,
    isGold: gold,
    goldPlan: gold ? user.goldSubscription?.plan : null,
    goldUntil: gold ? user.goldSubscription?.currentPeriodEnd : null,
    adFree: gold,
    appIcon: custom.appIconId || 'classic',
    cameraTheme: custom.cameraThemeId || 'soft-pink',
    badgeStyle: custom.badgeId || 'gold-star',
    badgeVisible: custom.badgeVisible !== false,
    profileFrame: custom.profileFrame || 'none',
    profileBg: custom.profileBg || 'soft',
    createdAt: user.createdAt,
    ...extras,
  }
}
