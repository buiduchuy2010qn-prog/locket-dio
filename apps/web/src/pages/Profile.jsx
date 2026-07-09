import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import Avatar from '../components/Avatar'
import { PROFILE_BACKGROUNDS } from '../data/constants'
import { Settings, Palette, Flame, Images } from 'lucide-react'

export default function Profile() {
  const { user, updateUser, toast } = useApp()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    bio: user?.bio || '',
    username: user?.username || '',
  })

  const bg = PROFILE_BACKGROUNDS.find((b) => b.id === (user?.profileBg || 'soft')) || PROFILE_BACKGROUNDS[0]

  const save = async () => {
    try {
      await updateUser(form)
      toast('Đã cập nhật profile')
      setEditing(false)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div className="px-4 md:px-0 max-w-xl mx-auto pb-4">
      <div className={`rounded-[1.75rem] overflow-hidden border border-slate-100 dark:border-white/5 shadow-[var(--shadow-card)] bg-gradient-to-br ${bg.className}`}>
        <div className="h-28 md:h-32" />
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur px-5 pb-5 -mt-12 relative">
          <div className="flex justify-between items-end">
            <Avatar user={user} size="xl" className="-mt-10 ring-4 ring-white dark:ring-slate-900 rounded-full" />
            <div className="flex gap-2 mb-1">
              <Link to="/app/settings" className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 press">
                <Settings size={18} />
              </Link>
              <Link to="/app/gold/customize" className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1 press">
                <Palette size={14} /> Theme
              </Link>
            </div>
          </div>
          <div className="mt-3">
            <h1 className="font-display font-extrabold text-xl">{user?.displayName}</h1>
            <p className="text-sm text-slate-500">@{user?.username}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {user?.bio || 'Chưa có bio — kể một chút về bạn ✨'}
            </p>
          </div>
          <div className="mt-4 flex gap-6">
            <Link to="/app/gallery" className="text-center hover:opacity-80">
              <Images size={16} className="mx-auto text-indigo-500 mb-0.5" />
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Gallery</p>
            </Link>
            <Link to="/app/friends" className="text-center hover:opacity-80">
              <p className="font-extrabold text-sm">Circle</p>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Friends</p>
            </Link>
            <Link to="/app/streaks" className="text-center hover:opacity-80">
              <Flame size={16} className="mx-auto text-orange-500 mb-0.5" />
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Streaks</p>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm press"
        >
          {editing ? 'Đóng' : 'Sửa profile'}
        </button>
        <Link
          to="/app/upload"
          className="flex-1 py-2.5 rounded-xl dio-gradient text-white font-bold text-sm text-center press shadow-[var(--shadow-dio)]"
        >
          Camera
        </Link>
      </div>

      {editing && (
        <div className="mt-4 card-surface p-4 space-y-3 page-enter">
          {['displayName', 'username', 'bio'].map((k) => (
            <div key={k}>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{k}</label>
              {k === 'bio' ? (
                <textarea
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-400"
                />
              ) : (
                <input
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-400"
                />
              )}
            </div>
          ))}
          <button type="button" onClick={save} className="w-full py-3 rounded-xl dio-gradient text-white font-bold press">
            Lưu
          </button>
        </div>
      )}
    </div>
  )
}
