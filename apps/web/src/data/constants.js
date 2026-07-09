// Full features for everyone — no Gold paywall, no hard limits
export const FREE_FRIEND_LIMIT = 99999
export const FREE_VIDEO_MAX_SEC = 300
export const GOLD_VIDEO_MAX_SEC = 300
export const MAX_UPLOAD_MB = 200

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

export const BADGE_STYLES = [
  { id: 'gold-star', name: 'Gold Star', icon: '⭐', label: 'Gold' },
  { id: 'crown', name: 'Crown', icon: '👑', label: 'Gold' },
  { id: 'sparkle', name: 'Sparkle', icon: '✨', label: 'Gold' },
  { id: 'minimal-gold', name: 'Minimal Gold', icon: '◆', label: 'Gold' },
  { id: 'neon-gold', name: 'Neon Gold', icon: '⚡', label: 'GOLD' },
]

export const PROFILE_FRAMES = [
  { id: 'none', name: 'None', ring: '' },
  { id: 'gold-ring', name: 'Gold Ring', ring: 'ring-2 ring-amber-400 ring-offset-2' },
  { id: 'sparkle-ring', name: 'Sparkle', ring: 'ring-2 ring-fuchsia-400 ring-offset-2' },
  { id: 'neon-ring', name: 'Neon', ring: 'ring-2 ring-cyan-400 ring-offset-2' },
  { id: 'glass-ring', name: 'Glass', ring: 'ring-2 ring-white/80 ring-offset-2 shadow-lg' },
]

export const PROFILE_BACKGROUNDS = [
  { id: 'soft', name: 'Soft', className: 'from-amber-50 via-rose-50 to-orange-50' },
  { id: 'aurora', name: 'Aurora', className: 'from-violet-500 via-fuchsia-400 to-amber-300' },
  { id: 'ocean', name: 'Ocean', className: 'from-sky-400 via-blue-500 to-indigo-600' },
  { id: 'sunset', name: 'Sunset', className: 'from-orange-400 via-rose-400 to-purple-500' },
  { id: 'noir', name: 'Noir Gold', className: 'from-zinc-900 via-stone-800 to-amber-700' },
]

export const BASIC_REACTIONS = ['❤️', '😂', '🔥', '👏', '😍']
export const GOLD_REACTIONS = ['✨', '💯', '🥳', '🥹', '👑', '🌟', '💫', '🎉', '🥰', '⚡']

export const PLANS = {
  monthly: { id: 'monthly', label: 'Hàng tháng', price: 49000, period: '/tháng', save: null },
  yearly: { id: 'yearly', label: 'Hàng năm', price: 399000, period: '/năm', save: 'Tiết kiệm 32%' },
}

export const GOLD_FEATURES = [
  { id: 'no-ads', title: 'Không quảng cáo', desc: 'Trải nghiệm sạch, tập trung khoảnh khắc' },
  { id: 'unlimited-friends', title: 'Bạn bè không giới hạn', desc: 'Kết nối mọi người thân yêu' },
  { id: 'camera-roll', title: 'Tải từ thư viện', desc: 'Chọn ảnh/video có sẵn trên máy' },
  { id: 'long-video', title: 'Video dài hơn', desc: `Tối đa ${GOLD_VIDEO_MAX_SEC} giây thay vì ${FREE_VIDEO_MAX_SEC}s` },
  { id: 'app-icons', title: 'Icon ứng dụng', desc: '6 chủ đề icon gốc Piclet' },
  { id: 'camera-themes', title: 'Theme camera', desc: '6 giao diện camera cao cấp' },
  { id: 'badge', title: 'Huy hiệu Gold', desc: 'Hiển thị badge trên profile & bài đăng' },
  { id: 'streak-restore', title: 'Khôi phục streak', desc: 'Cứu chuỗi ngày đăng với bạn bè' },
  { id: 'profile', title: 'Profile tùy biến', desc: 'Nền, khung, viền avatar premium' },
  { id: 'reactions', title: 'Reaction Gold', desc: 'Emoji động & bộ reaction mở rộng' },
  { id: 'insights', title: 'Insights', desc: 'Seen by, tương tác, recap tuần' },
]

export const GOLD_DROPS = [
  { id: 'd1', month: 'Tháng 7', title: 'Black Gold Icons', status: 'live', desc: 'Bộ icon tối sang trọng vừa ra mắt' },
  { id: 'd2', month: 'Tháng 7', title: 'Streak Restore', status: 'live', desc: 'Khôi phục streak đã lỡ một ngày' },
  { id: 'd3', month: 'Tháng 8', title: 'Voice Moments', status: 'soon', desc: 'Gửi ghi âm ngắn kèm ảnh' },
  { id: 'd4', month: 'Tháng 9', title: 'Duo Widgets', status: 'soon', desc: 'Widget desktop & mobile (sắp có)' },
]

export const FREE_VS_GOLD = [
  { feature: 'Đăng ảnh khoảnh khắc', free: true, gold: true },
  { feature: 'Bạn bè', free: `${FREE_FRIEND_LIMIT} bạn`, gold: 'Không giới hạn' },
  { feature: 'Video', free: `Tối đa ${FREE_VIDEO_MAX_SEC}s`, gold: `Tối đa ${GOLD_VIDEO_MAX_SEC}s` },
  { feature: 'Tải từ thư viện', free: false, gold: true },
  { feature: 'Không quảng cáo', free: false, gold: true },
  { feature: 'Theme camera & icon', free: false, gold: true },
  { feature: 'Huy hiệu & profile Gold', free: false, gold: true },
  { feature: 'Khôi phục streak', free: false, gold: true },
  { feature: 'Reaction mở rộng', free: 'Cơ bản', gold: 'Đầy đủ + animated' },
  { feature: 'Seen by & Insights', free: false, gold: true },
]
