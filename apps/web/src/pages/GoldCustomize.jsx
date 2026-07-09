import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  APP_ICONS, BADGE_STYLES, CAMERA_THEMES, PROFILE_BACKGROUNDS, PROFILE_FRAMES,
} from '../data/constants'
import { BadgePreview } from '../components/GoldBadge'
import Avatar from '../components/Avatar'

export default function GoldCustomize() {
  const { user, updateUser, toast } = useApp()

  const set = async (patch) => {
    await updateUser(patch)
    toast('Đã lưu tuỳ chỉnh')
  }

  return (
    <div className="px-4 md:px-0 max-w-2xl mx-auto space-y-6 pb-8">
      <div>
        <Link to="/app/settings" className="text-sm font-semibold text-amber-600">← Cài đặt</Link>
        <h1 className="text-2xl font-extrabold mt-1">Tuỳ chỉnh</h1>
        <p className="text-sm text-slate-500">Icon, theme camera, badge, profile — free cho mọi người</p>
      </div>

      <div className={`rounded-3xl p-5 bg-gradient-to-br ${(PROFILE_BACKGROUNDS.find((b) => b.id === user?.profileBg) || PROFILE_BACKGROUNDS[0]).className} border border-white/40 shadow-[var(--shadow-card)]`}>
        <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-2xl p-4">
          <Avatar user={user} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-extrabold">{user?.displayName}</p>
              {user?.badgeVisible !== false && <BadgePreview styleId={user?.badgeStyle} />}
            </div>
            <p className="text-xs text-slate-500">@{user?.username}</p>
            <p className="text-xs mt-1">Icon: {user?.appIcon} · Cam: {user?.cameraTheme}</p>
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-bold mb-2">App icons</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {APP_ICONS.map((icon) => (
            <button
              key={icon.id}
              type="button"
              onClick={() => set({ appIcon: icon.id })}
              className={`p-3 rounded-2xl border text-center transition ${
                user?.appIcon === icon.id ? 'border-amber-400 ring-2 ring-amber-300' : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              <div className={`w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br ${icon.gradient} flex items-center justify-center text-xl shadow`}>
                {icon.emoji}
              </div>
              <p className="text-[10px] font-bold mt-1.5">{icon.name}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-bold mb-2">Camera themes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CAMERA_THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => set({ cameraTheme: t.id })}
              className={`p-3 rounded-2xl border text-left ${
                user?.cameraTheme === t.id ? 'border-amber-400 ring-2 ring-amber-300' : 'border-slate-100 dark:border-slate-800'
              }`}
            >
              <div className="h-10 rounded-xl mb-2" style={{ background: t.preview }} />
              <p className="text-xs font-bold">{t.name}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-bold mb-2">Badge</h2>
        <div className="flex flex-wrap gap-2 mb-2">
          {BADGE_STYLES.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => set({ badgeStyle: b.id })}
              className={`px-3 py-2 rounded-xl border text-sm ${
                user?.badgeStyle === b.id ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {b.icon} {b.name}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={user?.badgeVisible !== false}
            onChange={(e) => set({ badgeVisible: e.target.checked })}
            className="accent-amber-500"
          />
          Hiện badge trên profile & posts
        </label>
      </section>

      <section>
        <h2 className="font-bold mb-2">Profile frame</h2>
        <div className="flex flex-wrap gap-2">
          {PROFILE_FRAMES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => set({ profileFrame: f.id })}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold ${
                user?.profileFrame === f.id ? 'border-amber-400' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-bold mb-2">Backgrounds</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PROFILE_BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => set({ profileBg: b.id })}
              className={`h-16 rounded-2xl bg-gradient-to-br ${b.className} border-2 ${
                user?.profileBg === b.id ? 'border-amber-400' : 'border-transparent'
              }`}
            >
              <span className="text-[10px] font-bold bg-black/30 text-white px-2 py-0.5 rounded-full">{b.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
