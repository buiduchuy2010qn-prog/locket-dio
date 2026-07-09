import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Moon, Sun, Bell, Shield, Palette, LogOut, ChevronRight, Bug } from 'lucide-react'

export default function Settings() {
  const { user, updateUser, toggleTheme, theme, logout, toast } = useApp()
  const nav = useNavigate()

  const toggleNotif = async (key) => {
    const notifSettings = { ...user.notifSettings, [key]: !user.notifSettings?.[key] }
    await updateUser({ notifSettings })
    toast('Đã cập nhật thông báo')
  }

  const togglePrivacy = async (key) => {
    const privacy = { ...user.privacy, [key]: !user.privacy?.[key] }
    await updateUser({ privacy })
    toast('Đã cập nhật quyền riêng tư')
  }

  return (
    <div className="px-4 md:px-0 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-extrabold">Settings</h1>

      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden">
        <h2 className="px-4 pt-4 text-xs font-bold text-slate-400 uppercase">Giao diện</h2>
        <button type="button" onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800">
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          <span className="flex-1 text-left text-sm font-semibold">Dark mode</span>
          <span className="text-xs text-slate-400">{theme === 'dark' ? 'Bật' : 'Tắt'}</span>
        </button>
      </section>

      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden">
        <h2 className="px-4 pt-4 text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Bell size={12} /> Thông báo</h2>
        {['moments', 'friends', 'streaks'].map((k) => (
          <label key={k} className="flex items-center gap-3 px-4 py-3 border-t border-slate-50 dark:border-slate-800 cursor-pointer">
            <span className="flex-1 text-sm font-medium capitalize">{k}</span>
            <input
              type="checkbox"
              checked={!!user?.notifSettings?.[k]}
              onChange={() => toggleNotif(k)}
              className="w-4 h-4 accent-amber-500"
            />
          </label>
        ))}
      </section>

      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden">
        <h2 className="px-4 pt-4 text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Shield size={12} /> Riêng tư</h2>
        <label className="flex items-center gap-3 px-4 py-3 border-t border-slate-50 dark:border-slate-800">
          <span className="flex-1 text-sm font-medium">Friends only (mặc định)</span>
          <input type="checkbox" checked={!!user?.privacy?.friendsOnly} onChange={() => togglePrivacy('friendsOnly')} className="accent-amber-500" />
        </label>
        <label className="flex items-center gap-3 px-4 py-3 border-t border-slate-50 dark:border-slate-800">
          <span className="flex-1 text-sm font-medium">Hiện activity</span>
          <input type="checkbox" checked={!!user?.privacy?.showActivity} onChange={() => togglePrivacy('showActivity')} className="accent-amber-500" />
        </label>
      </section>

      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden">
        <h2 className="px-4 pt-4 text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Palette size={12} /> Tuỳ chỉnh</h2>
        <Link to="/app/gold/customize" className="flex items-center px-4 py-3 border-t border-slate-50 dark:border-slate-800 text-sm font-semibold">
          Theme camera & profile <ChevronRight size={16} className="ml-auto" />
        </Link>
      </section>

      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden">
        <Link to="/app/admin" className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-500">
          <Bug size={16} /> Admin / Mock debug <ChevronRight size={16} className="ml-auto" />
        </Link>
      </section>

      <button
        type="button"
        onClick={async () => { await logout(); nav('/login') }}
        className="w-full py-3.5 rounded-2xl border border-red-200 text-red-600 font-bold text-sm flex items-center justify-center gap-2"
      >
        <LogOut size={16} /> Đăng xuất
      </button>
    </div>
  )
}
