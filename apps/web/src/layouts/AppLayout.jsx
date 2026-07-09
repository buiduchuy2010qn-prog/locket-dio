import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Home, Camera, Users, Images, Flame, Bell, User, Settings, LogOut, MessageCircle,
} from 'lucide-react'
import Logo from '../components/Logo'
import Avatar from '../components/Avatar'
import ToastStack from '../components/Toast'
import UpgradeModal from '../components/UpgradeModal'
import { useApp } from '../context/AppContext'
import { useEffect, useState } from 'react'
import * as api from '../api/index.js'

const sideNav = [
  { to: '/app/feed', label: 'Feed', icon: Home },
  { to: '/app/upload', label: 'Camera', icon: Camera },
  { to: '/app/friends', label: 'Bạn bè', icon: Users },
  { to: '/app/gallery', label: 'Lịch sử', icon: Images },
  { to: '/app/streaks', label: 'Streaks', icon: Flame },
  { to: '/app/notifications', label: 'Thông báo', icon: Bell, badge: true },
  { to: '/app/chat', label: 'Chat', icon: MessageCircle },
  { to: '/app/profile', label: 'Hồ sơ', icon: User },
  { to: '/app/settings', label: 'Cài đặt', icon: Settings },
]

const mobileNav = [
  { to: '/app/feed', label: 'Feed', icon: Home },
  { to: '/app/friends', label: 'Bạn', icon: Users },
  { to: '/app/upload', label: 'Cam', icon: Camera, fab: true },
  { to: '/app/gallery', label: 'Lưu', icon: Images },
  { to: '/app/profile', label: 'Tôi', icon: User },
]

export default function AppLayout() {
  const { user, logout, unreadCount } = useApp()
  const navg = useNavigate()
  const location = useLocation()
  const [activity, setActivity] = useState([])
  const isCamera = location.pathname.startsWith('/app/upload')

  useEffect(() => {
    api.fetchFriends().then((f) => setActivity(f.slice(0, 5))).catch(() => {})
  }, [location.pathname])

  if (isCamera) {
    return (
      <div className="min-h-dvh bg-white">
        <Outlet />
        <ToastStack />
        <UpgradeModal />
      </div>
    )
  }

  return (
    <div className="min-h-dvh sparkle-bg flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[260px] xl:w-72 flex-col border-r border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-[#0c1222]/80 backdrop-blur-xl sticky top-0 h-dvh p-4">
        <Logo className="mb-8 px-2" />
        <nav className="flex-1 space-y-0.5 overflow-y-auto custom-scroll">
          {sideNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition press ${
                    isActive
                      ? 'dio-gradient text-white shadow-[var(--shadow-dio)]'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5'
                  }`
                }
              >
                <Icon size={18} strokeWidth={2.2} />
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
        <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <Avatar user={user} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate">{user?.displayName}</p>
              <p className="text-[11px] text-slate-400 truncate">@{user?.username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout().then(() => navg('/login'))}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-slate-200"
          >
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 pb-nav lg:pb-6">
        <header className="lg:hidden sticky top-0 z-40 glass safe-pt border-b border-slate-200/50 dark:border-white/5 px-4 py-3 flex items-center justify-between">
          <Logo size="sm" />
          <NavLink to="/app/notifications" className="relative p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 press">
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        </header>

        <div className="max-w-6xl mx-auto flex gap-6 px-0 md:px-4 lg:px-6 py-0 md:py-6">
          <div className="flex-1 min-w-0 page-enter">
            <Outlet />
          </div>

          <aside className="hidden xl:block w-72 shrink-0 space-y-4 sticky top-6 self-start">
            <div className="card-surface p-4">
              <h3 className="font-display font-bold text-sm mb-3">Circle của bạn</h3>
              {activity.length === 0 ? (
                <p className="text-xs text-slate-400 leading-relaxed">
                  Chưa có bạn bè.{' '}
                  <button type="button" className="text-indigo-600 font-semibold" onClick={() => navg('/app/friends')}>
                    Thêm ngay
                  </button>
                </p>
              ) : (
                <div className="space-y-3">
                  {activity.map((f) => (
                    <div key={f.userId || f.user?.id} className="flex items-center gap-2.5">
                      <Avatar user={f.user} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{f.user?.displayName}</p>
                        <p className="text-[11px] text-slate-400">@{f.user?.username}</p>
                      </div>
                      {f.streak > 0 && (
                        <span className="text-xs font-bold text-orange-500">🔥{f.streak}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-3xl dio-gradient p-4 text-white shadow-[var(--shadow-dio)]">
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Camera</p>
              <p className="font-display font-bold text-lg mt-1">Chụp moment 1:1</p>
              <button
                type="button"
                onClick={() => navg('/app/upload')}
                className="mt-3 w-full py-2.5 rounded-xl bg-white text-indigo-700 text-sm font-bold press"
              >
                Mở camera
              </button>
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 glass border-t border-slate-200/60 dark:border-white/5 safe-pb">
        <div className="flex items-end justify-around px-1 pt-1 pb-1 max-w-lg mx-auto">
          {mobileNav.map((item) => {
            const Icon = item.icon
            if (item.fab) {
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="relative -top-5 w-14 h-14 rounded-full dio-gradient text-white flex items-center justify-center shadow-[var(--shadow-dio)] press ring-4 ring-white dark:ring-[#070b14]"
                >
                  <Icon size={26} strokeWidth={2.2} />
                </NavLink>
              )
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 px-3 text-[10px] font-semibold press ${
                    isActive ? 'text-indigo-600' : 'text-slate-400'
                  }`
                }
              >
                <Icon size={22} strokeWidth={2} />
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
