import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, Flame } from 'lucide-react'
import * as api from '../api/index.js'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import { useApp } from '../context/AppContext'

export default function Friends() {
  const { toast } = useApp()
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [username, setUsername] = useState('')
  const [tab, setTab] = useState('all')

  const load = () => api.fetchFriends().then(setList).catch(() => setList([]))
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const t = setTimeout(() => api.searchUsers(q).then(setResults).catch(() => setResults([])), 250)
    return () => clearTimeout(t)
  }, [q])

  const add = async (uname) => {
    try {
      const r = await api.addFriend(uname)
      toast(r.message || 'Đã kết bạn')
      setUsername('')
      setQ('')
      setResults([])
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const remove = async (id) => {
    if (!confirm('Xóa bạn này?')) return
    await api.removeFriend(id)
    toast('Đã xóa bạn')
    load()
  }

  const shown = tab === 'close' ? list.filter((f) => f.close) : list

  return (
    <div className="px-4 md:px-0 max-w-2xl mx-auto space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Bạn bè</h1>
          <p className="text-sm text-slate-500">{list.length} người trong circle</p>
        </div>
        <Link to="/app/friends/requests" className="text-sm font-bold text-indigo-600">
          Lời mời →
        </Link>
      </div>

      <div className="card-surface p-4 space-y-3">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Thêm bằng username</label>
        <div className="flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button type="button" onClick={() => add(username)} className="px-4 py-2.5 rounded-xl dio-gradient text-white font-bold text-sm flex items-center gap-1 press">
            <UserPlus size={16} /> Thêm
          </button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm user…"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        {results.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto custom-scroll">
            {results.map((u) => (
              <div key={u.id} className="flex items-center gap-2 py-1">
                <Avatar user={u} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{u.displayName}</p>
                  <p className="text-xs text-slate-400">@{u.username}</p>
                </div>
                {u.isFriend ? (
                  <span className="text-xs text-slate-400">Đã kết bạn</span>
                ) : (
                  <button type="button" onClick={() => add(u.username)} className="text-xs font-bold text-indigo-600 press">
                    + Kết bạn
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {[
          ['all', 'Tất cả'],
          ['close', 'Close friends'],
        ].map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-full text-xs font-bold press ${
              tab === k ? 'dio-gradient text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="👋" title="Chưa có bạn bè" desc="Tìm username và kết bạn để chia sẻ moment." />
      ) : (
        <div className="space-y-2">
          {shown.map((f) => (
            <div key={f.userId || f.user?.id} className="card-surface p-3.5 flex items-center gap-3">
              <Avatar user={f.user} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{f.user?.displayName}</p>
                <p className="text-xs text-slate-400">@{f.user?.username}</p>
              </div>
              {(f.streak > 0) && (
                <span className="text-xs font-bold text-orange-500 flex items-center gap-0.5">
                  <Flame size={12} /> {f.streak}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(f.userId || f.user?.id)}
                className="text-xs font-semibold text-rose-500 px-2 py-1 press"
              >
                Xóa
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
