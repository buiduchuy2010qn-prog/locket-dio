/** Shared constants & helpers — Locket Dio (independent app) */

// All features free for every account
export const FREE_FRIEND_LIMIT = 99999
export const FREE_VIDEO_MAX_SEC = 60
export const GOLD_VIDEO_MAX_SEC = 60
export const FREE_MAX_UPLOAD_MB = 50
export const GOLD_MAX_UPLOAD_MB = 50

export const BASIC_REACTIONS = ['❤️', '😂', '🔥', '👏', '😍']
export const GOLD_REACTIONS = ['✨', '💯', '🥳', '🥹', '👑', '🌟', '💫', '🎉', '🥰', '⚡']
export const ALL_REACTIONS = [...BASIC_REACTIONS, ...GOLD_REACTIONS]

export const PLANS = {
  full: { id: 'full', label: 'Full access', priceCents: 0, period: 'forever' },
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
  { id: 'gold-star', name: 'Gold Star', icon: '⭐', label: 'Dio' },
  { id: 'crown', name: 'Crown', icon: '👑', label: 'Dio' },
  { id: 'sparkle', name: 'Sparkle', icon: '✨', label: 'Dio' },
  { id: 'minimal-gold', name: 'Minimal Gold', icon: '◆', label: 'Dio' },
  { id: 'neon-gold', name: 'Neon Gold', icon: '⚡', label: 'DIO' },
]

/** All accounts get full feature access (no paywall) */
export function isGoldActive(_sub) {
  return true
}

export function publicUser(user, extras = {}) {
  if (!user) return null
  // Flat mock users already have displayName etc.
  if (!user.profile && user.displayName) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role || 'USER',
      emailVerified: !!user.emailVerifiedAt,
      displayName: user.displayName,
      bio: user.bio || '',
      avatar: user.avatar,
      darkMode: !!user.darkMode,
      showActivity: user.showActivity !== false,
      isGold: true,
      adFree: true,
      appIcon: user.appIcon || 'classic',
      cameraTheme: user.cameraTheme || 'soft-pink',
      badgeStyle: user.badgeStyle || 'gold-star',
      badgeVisible: user.badgeVisible !== false,
      profileFrame: user.profileFrame || 'none',
      profileBg: user.profileBg || 'soft',
      createdAt: user.createdAt,
      ...extras,
    }
  }
  const profile = user.profile || {}
  const custom = user.goldCustomization || {}
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    emailVerified: !!user.emailVerifiedAt,
    displayName: profile.displayName || user.username,
    bio: profile.bio || '',
    avatar:
      profile.avatarUrl ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}`,
    darkMode: !!profile.darkMode,
    showActivity: profile.showActivity !== false,
    isGold: true,
    goldPlan: 'full',
    goldUntil: null,
    adFree: true,
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

export function sanitizeText(s, max = 2000) {
  return String(s || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, max)
}
