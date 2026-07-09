import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Moon, Sun, Bell, Shield, Palette, LogOut, ChevronRight, Bug, Sparkles } from 'lucide-react'
import { useBackgroundEffect } from '../effects/BackgroundEffectProvider'
import { EFFECT_LIST } from '../effects/constants'

export default function Settings() {
  const { user, updateUser, toggleTheme, theme, logout, toast } = useApp()
  const { settings, update, effectId } = useBackgroundEffect()
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

  const currentFx = EFFECT_LIST.find((e) => e.id === effectId) || EFFECT_LIST[0]

  return (
    <div className="px-4 md:px-0 max-w-xl mx-auto space-y-4 pb-4">
      <h1 className="font-display font-extrabold text-2xl">Cài đặt</h1>

      <section className="card-surface overflow-hidden">
        <h2 className="px-4 pt-4 text-xs font-bold text-slate-400 uppercase">Giao diện</h2>
        <button type="button" onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800">
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          <span className="flex-1 text-left text-sm font-semibold">Dark mode</span>
          <span className="text-xs text-slate-400">{theme === 'dark' ? 'Bật' : 'Tắt'}</span>
        </button>
      </section>

      {/* Background Effects */}
      <section className="card-surface overflow-hidden">
        <h2 className="px-4 pt-4 text-xs font-bold text-slate-400 uppercase flex items-center gap-1">
          <Sparkles size={12} /> Background Effects
        </h2>
        <label className="flex items-center gap-3 px-4 py-3 border-t border-slate-50 dark:border-slate-800 cursor-pointer">
          <span className="flex-1 text-sm font-medium">Bật hiệu ứng nền</span>
          <input
            type="checkbox"
            checked={!!settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="w-4 h-4 accent-indigo-500"
          />
        </label>
        <label className="flex items-center gap-3 px-4 py-3 border-t border-slate-50 dark:border-slate-800 cursor-pointer">
          <div className="flex-1">
            <p className="text-sm font-medium">Reduce motion</p>
            <p className="text-[11px] text-slate-400">Tắt animation</p>
          </div>
          <input
            type="checkbox"
            checked={!!settings.reduceMotion}
            onChange={(e) => update({ reduceMotion: e.target.checked })}
            className="w-4 h-4 accent-indigo-500"
          />
        </label>
        <label className="flex items-center gap-3 px-4 py-3 border-t border-slate-50 dark:border-slate-800 cursor-pointer">
          <div className="flex-1">
            <p className="text-sm font-medium">Low performance mode</p>
            <p className="text-[11px] text-slate-400">Ít particle hơn</p>
          </div>
          <input
            type="checkbox"
            checked={!!settings.lowPerf}
            onChange={(e) => update({ lowPerf: e.target.checked })}
            className="w-4 h-4 accent-indigo-500"
          />
        </label>
        <Link
          to="/app/gold/customize"
          className="flex items-center gap-2 px-4 py-3.5 border-t border-slate-50 dark:border-slate-800 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <span className="text-lg">{currentFx.emoji}</span>
          <div className="flex-1 min-w-0">
            <p>Chọn hiệu ứng</p>
            <p className="text-[11px] text-slate-400 font-normal truncate">{currentFx.name} · Soft Rain, Stars…</p>
          </div>
          <ChevronRight size={16} className="text-slate-400" />
        </Link>
      </section>

      <section className="card-surface overflow-hidden">
        <h2 className="px-4 pt-4 text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Bell size={12} /> Thông báo</h2>
        {['moments', 'friends', 'streaks'].map((k) => (
          <label key={k} className="flex items-center gap-3 px-4 py-3 border-t border-slate-50 dark:border-slate-800 cursor-pointer">
            <span className="flex-1 text-sm font-medium capitalize">{k}</span>
            <input
              type="checkbox"
              checked={!!user?.notifSettings?.[k]}
              onChange={() => toggleNotif(k)}
              className="w-4 h-4 accent-indigo-500"
            />
          </label>
        ))}
      </section>

      <section className="card-surface overflow-hidden">
        <h2 className="px-4 pt-4 text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Shield size={12} /> Riêng tư</h2>
        <label className="flex items-center gap-3 px-4 py-3 border-t border-slate-50 dark:border-slate-800">
          <span className="flex-1 text-sm font-medium">Friends only (mặc định)</span>
          <input type="checkbox" checked={!!user?.privacy?.friendsOnly} onChange={() => togglePrivacy('friendsOnly')} className="accent-indigo-500" />
        </label>
        <label className="flex items-center gap-3 px-4 py-3 border-t border-slate-50 dark:border-slate-800">
          <span className="flex-1 text-sm font-medium">Hiện activity</span>
          <input type="checkbox" checked={!!user?.privacy?.showActivity} onChange={() => togglePrivacy('showActivity')} className="accent-indigo-500" />
        </label>
      </section>

      <section className="card-surface overflow-hidden">
        <h2 className="px-4 pt-4 text-xs font-bold text-slate-400 uppercase flex items-center gap-1"><Palette size={12} /> Tuỳ chỉnh</h2>
        <Link to="/app/gold/customize" className="flex items-center px-4 py-3 border-t border-slate-50 dark:border-slate-800 text-sm font-semibold">
          Theme camera & profile & effects <ChevronRight size={16} className="ml-auto" />
        </Link>
      </section>

      <section className="card-surface overflow-hidden">
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
