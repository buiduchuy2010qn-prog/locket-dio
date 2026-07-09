import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Home, Camera, Users, Images, Flame, Bell, Crown, User, Settings, LogOut, Sparkles, Link2,
} from 'lucide-react'
import Logo from '../components/Logo'
import Avatar from '../components/Avatar'
import { GoldPill } from '../components/GoldBadge'
import ToastStack from '../components/Toast'
import UpgradeModal from '../components/UpgradeModal'
import { useApp } from '../context/AppContext'
import { useEffect, useState } from 'react'
import * as api from '../api/index.js'

const nav = [
  { to: '/app/feed', label: 'Feed', icon: Home },
  { to: '/app/upload', label: 'Upload', icon: Camera },
  { to: '/app/friends', label: 'Friends', icon: Users },
  { to: '/app/gallery', label: 'Gallery', icon: Images },
  { to: '/app/streaks', label: 'Streaks', icon: Flame },
  { to: '/app/notifications', label: 'Notifications', icon: Bell, badge: true },
  { to: '/app/gold', label: 'Gold', icon: Crown },
  { to: '/app/connect-locket', label: 'Connect Locket', icon: Link2 },
  { to: '/app/profile', label: 'Profile', icon: User },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

const mobileNav = [
  { to: '/app/feed', label: 'Feed', icon: Home },
  { to: '/app/friends', label: 'Friends', icon: Users },
  { to: '/app/upload', label: 'Upload', icon: Camera, fab: true },
  { to: '/app/gallery', label: 'Gallery', icon: Images },
  { to: '/app/profile', label: 'Profile', icon: User },
]

export default function AppLayout() {
  const { user, logout, unreadCount, theme } = useApp()
  const navg = useNavigate()
  const [activity, setActivity] = useState([])
  const [streaks, setStreaks] = useState([])

  useEffect(() => {
    api.fetchFriends().then((f) => setActivity(f.slice(0, 6)))
    api.fetchStreaks().then((s) => setStreaks(s.filter((x) => x.count > 0).slice(0, 3)))
  }, [])

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
      isActive
        ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
    }`

  return (
    <div className="min-h-screen sparkle-bg flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 xl:w-72 flex-col border-r border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl sticky top-0 h-screen p-4">
        <Logo className="mb-6 px-1" />
        <nav className="flex-1 space-y-1 custom-scroll overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                <Icon size={18} />
                <span className="flex-1">{item.label}</span>
                {item.badge && unreadCount > 0 && (
                  <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
        <div className="mt-3 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Avatar user={user} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{user?.displayName}</p>
              <p className="text-[11px] text-slate-400 truncate">@{user?.username}</p>
            </div>
            {user?.isGold ? <GoldPill /> : (
              <button type="button" onClick={() => navg('/app/gold')} className="text-amber-600">
                <Sparkles size={16} />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => logout().then(() => navg('/login'))}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200"
          >
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-6">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 glass safe-pt border-b border-slate-200/60 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <NavLink to="/app/notifications" className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </NavLink>
            <NavLink to="/app/gold" className="p-2 rounded-xl gold-gradient text-white">
              <Crown size={18} />
            </NavLink>
          </div>
        </header>

        <div className="max-w-6xl mx-auto flex gap-6 px-0 md:px-4 lg:px-6 py-0 md:py-6">
          <div className="flex-1 min-w-0 page-enter">
            <Outlet />
          </div>

          {/* Right panel desktop */}
          <aside className="hidden xl:block w-72 shrink-0 space-y-4 sticky top-6 self-start">
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 shadow-[var(--shadow-soft)]">
              <h3 className="font-bold text-sm mb-3">Hoạt động bạn bè</h3>
              <div className="space-y-3">
                {activity.map((f) => (
                  <div key={f.userId} className="flex items-center gap-2">
                    <div className="relative">
                      <Avatar user={f.user} size="sm" />
                      {f.user?.online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{f.user?.displayName}</p>
                      <p className="text-[11px] text-slate-400">{f.user?.online ? 'Đang online' : 'Gần đây'}</p>
                    </div>
                    {f.streak > 0 && (
                      <span className="ml-auto text-xs font-bold text-orange-500">🔥 {f.streak}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 shadow-[var(--shadow-soft)]">
              <h3 className="font-bold text-sm mb-3">Streak nhắc nhở</h3>
              {streaks.length === 0 ? (
                <p className="text-xs text-slate-400">Chưa có streak — đăng moment với bạn bè!</p>
              ) : (
                streaks.map((s) => (
                  <div key={s.friendId} className="flex items-center gap-2 py-1.5">
                    <Avatar user={s.user} size="xs" />
                    <span className="text-sm flex-1 truncate">{s.user?.displayName}</span>
                    <span className="text-xs font-bold text-orange-500">🔥 {s.count}</span>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-3xl gold-gradient p-4 text-white shadow-[var(--shadow-gold)]">
              <p className="text-xs font-semibold opacity-90">Trạng thái Gold</p>
              <p className="font-extrabold text-lg mt-0.5">
                {user?.isGold ? 'Piclet Gold đang bật' : 'Gói Free'}
              </p>
              <p className="text-xs opacity-90 mt-1">
                {user?.isGold ? 'Ad-free · Unlimited friends · Themes' : 'Nâng cấp để mở toàn bộ tính năng'}
              </p>
              {!user?.isGold && (
                <button
                  type="button"
                  onClick={() => navg('/app/gold')}
                  className="mt-3 w-full py-2 rounded-xl bg-white text-amber-800 text-sm font-bold"
                >
                  Nâng cấp Gold
                </button>
              )}
              {user?.isGold && (
                <button
                  type="button"
                  onClick={() => navg('/app/gold/customize')}
                  className="mt-3 w-full py-2 rounded-xl bg-white/20 backdrop-blur text-sm font-bold"
                >
                  Tùy chỉnh Gold
                </button>
              )}
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 glass border-t border-slate-200/80 dark:border-slate-800 safe-pb">
        <div className="flex items-end justify-around px-2 pt-1 pb-1">
          {mobileNav.map((item) => {
            const Icon = item.icon
            if (item.fab) {
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="relative -top-4 w-14 h-14 rounded-full gold-gradient text-white flex items-center justify-center shadow-[var(--shadow-gold)] active:scale-95"
                >
                  <Icon size={24} />
                </NavLink>
              )
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 px-3 text-[10px] font-semibold ${
                    isActive ? 'text-amber-600' : 'text-slate-400'
                  }`
                }
              >
                <Icon size={22} />
                {item.label}
              </NavLink>
            )
          })}
        </div>
      </nav>

      <ToastStack />
      <UpgradeModal />
    </div>
  )
}
