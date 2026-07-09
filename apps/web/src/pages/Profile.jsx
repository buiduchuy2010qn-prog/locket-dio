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
    <div className="px-4 md:px-0 max-w-xl mx-auto">
      <div className={`rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-[var(--shadow-card)] bg-gradient-to-br ${bg.className}`}>
        <div className="h-28 md:h-36" />
        <div className="bg-white/90 dark:bg-slate-900/95 backdrop-blur px-5 pb-5 -mt-12 relative">
          <div className="flex justify-between items-end">
            <Avatar user={user} size="xl" className="-mt-10" />
            <div className="flex gap-2 mb-1">
              <Link to="/app/settings" className="p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                <Settings size={18} />
              </Link>
              <Link to="/app/gold/customize" className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1">
                <Palette size={14} /> Theme
              </Link>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold">{user?.displayName}</h1>
            </div>
            <p className="text-sm text-slate-500">@{user?.username}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {user?.bio || 'Chưa có bio'}
            </p>
          </div>
          <div className="mt-4 flex gap-4 text-center">
            <div>
              <p className="font-extrabold">—</p>
              <p className="text-[10px] text-slate-400 uppercase">Moments</p>
            </div>
            <Link to="/app/friends" className="hover:opacity-80">
              <p className="font-extrabold">Friends</p>
              <p className="text-[10px] text-slate-400 uppercase">Circle</p>
            </Link>
            <Link to="/app/streaks" className="hover:opacity-80">
              <p className="font-extrabold flex items-center justify-center gap-0.5"><Flame size={14} className="text-orange-500" /></p>
              <p className="text-[10px] text-slate-400 uppercase">Streaks</p>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setEditing((v) => !v)} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm">
          {editing ? 'Đóng' : 'Sửa profile'}
        </button>
        <Link to="/app/gallery" className="flex-1 py-2.5 rounded-xl gold-gradient text-white font-bold text-sm text-center flex items-center justify-center gap-1">
          <Images size={16} /> Gallery
        </Link>
      </div>

      {editing && (
        <div className="mt-4 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-3">
          {['displayName', 'username', 'bio'].map((k) => (
            <div key={k}>
              <label className="text-xs font-bold text-slate-500 uppercase">{k}</label>
              {k === 'bio' ? (
                <textarea
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800"
                />
              ) : (
                <input
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800"
                />
              )}
            </div>
          ))}
          <button type="button" onClick={save} className="w-full py-3 rounded-xl gold-gradient text-white font-bold">
            Lưu
          </button>
        </div>
      )}
    </div>
  )
}
