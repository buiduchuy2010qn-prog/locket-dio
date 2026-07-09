import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, Flame } from 'lucide-react'
import * as api from '../api/index.js'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import { useApp } from '../context/AppContext'
import { FREE_FRIEND_LIMIT } from '../data/constants'
import { GoldPill } from '../components/GoldBadge'

export default function Friends() {
  const { user, toast, openUpgrade } = useApp()
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [username, setUsername] = useState('')
  const [tab, setTab] = useState('all') // all | close

  const load = () => api.fetchFriends().then(setList)
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const t = setTimeout(() => api.searchUsers(q).then(setResults), 250)
    return () => clearTimeout(t)
  }, [q])

  const add = async (uname) => {
    try {
      const r = await api.addFriend(uname)
      toast(r.message || 'Đã gửi / kết bạn')
      setUsername('')
      load()
    } catch (e) {
      if (e.message.includes('Gold') || e.message.includes('tối đa')) {
        openUpgrade('Unlimited friends', e.message)
      } else toast(e.message, 'error')
    }
  }

  const remove = async (id) => {
    if (!confirm('Xóa bạn này?')) return
    await api.removeFriend(id)
    toast('Đã xóa bạn')
    load()
  }

  const block = async (id) => {
    if (!confirm('Chặn người dùng này?')) return
    await api.blockUser(id)
    toast('Đã chặn')
    load()
  }

  const shown = tab === 'close' ? list.filter((f) => f.close) : list
  const limitInfo = user?.isGold
    ? { text: 'Không giới hạn (Gold)' }
    : { text: `${list.length}/${FREE_FRIEND_LIMIT} bạn (Free)` }

  return (
    <div className="px-4 md:px-0 max-w-2xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Friends</h1>
          <p className="text-sm text-slate-500">{limitInfo.text}</p>
        </div>
        <Link to="/app/friends/requests" className="text-sm font-bold text-amber-600">
          Lời mời →
        </Link>
      </div>

      {!user?.isGold && list.length >= FREE_FRIEND_LIMIT - 1 && (
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-sm">
          Sắp đạt giới hạn Free. <button type="button" className="font-bold text-amber-700" onClick={() => openUpgrade('Unlimited friends', 'Gold: kết nối không giới hạn.')}>Nâng Gold</button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-4 shadow-[var(--shadow-soft)] space-y-3">
        <label className="text-xs font-bold text-slate-500 uppercase">Thêm bạn bằng username</label>
        <div className="flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="vd: hana.bloom"
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
          />
          <button type="button" onClick={() => add(username)} className="px-4 py-2.5 rounded-xl gold-gradient text-white font-bold text-sm flex items-center gap-1">
            <UserPlus size={16} /> Thêm
          </button>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm user…"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
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
                  <button type="button" onClick={() => add(u.username)} className="text-xs font-bold text-amber-600">+ Kết bạn</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {['all', 'close'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${tab === t ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'}`}
          >
            {t === 'all' ? 'Tất cả' : 'Close friends'}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="👋" title="Chưa có bạn" desc="Tìm username và gửi lời mời kết bạn." />
      ) : (
        <div className="space-y-2">
          {shown.map((f) => (
            <div key={f.userId} className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Avatar user={f.user} />
                {f.user?.online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm truncate">{f.user?.displayName}</p>
                  {f.user?.isGold && <GoldPill />}
                </div>
                <p className="text-xs text-slate-400">@{f.user?.username} · {f.user?.online ? 'Online' : 'Recent'}</p>
              </div>
              {f.streak > 0 && (
                <span className="text-sm font-bold text-orange-500 flex items-center gap-0.5"><Flame size={14} /> {f.streak}</span>
              )}
              <button type="button" onClick={() => remove(f.userId)} className="text-xs text-slate-400 hover:text-red-500">Xóa</button>
              <button type="button" onClick={() => block(f.userId)} className="text-xs text-slate-400 hover:text-red-600">Chặn</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
