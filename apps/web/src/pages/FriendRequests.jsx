import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api/index.js'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import { useApp } from '../context/AppContext'
import { timeAgo } from '../utils/storage'

export default function FriendRequests() {
  const { toast, refreshNotifications } = useApp()
  const [list, setList] = useState([])

  const load = () => api.fetchFriendRequests().then(setList)
  useEffect(() => { load() }, [])

  const accept = async (id) => {
    await api.acceptFriendRequest(id)
    toast('Đã chấp nhận kết bạn')
    load()
    refreshNotifications()
  }
  const decline = async (id) => {
    await api.declineFriendRequest(id)
    toast('Đã từ chối')
    load()
  }

  return (
    <div className="px-4 md:px-0 max-w-xl mx-auto">
      <Link to="/app/friends" className="text-sm font-semibold text-amber-600">← Friends</Link>
      <h1 className="text-2xl font-extrabold mt-2 mb-4">Lời mời kết bạn</h1>
      {list.length === 0 ? (
        <EmptyState icon="✉️" title="Không có lời mời" desc="Khi ai đó gửi request, bạn sẽ thấy ở đây." />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div key={r.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <Avatar user={r.fromUser} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{r.fromUser?.displayName}</p>
                <p className="text-xs text-slate-400">@{r.fromUser?.username} · {timeAgo(r.createdAt)}</p>
              </div>
              <button type="button" onClick={() => accept(r.id)} className="px-3 py-1.5 rounded-xl gold-gradient text-white text-xs font-bold">Chấp nhận</button>
              <button type="button" onClick={() => decline(r.id)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold">Từ chối</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
