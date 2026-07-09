import { useEffect, useMemo, useState } from 'react'
import * as api from '../api/index.js'
import { useApp } from '../context/AppContext'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Avatar from '../components/Avatar'
import { formatDateGroup, timeAgo } from '../utils/storage'
import { Download, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Gallery() {
  const { user, toast } = useApp()
  const [posts, setPosts] = useState([])
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)

  const load = () => api.fetchGallery().then(setPosts).catch(() => setPosts([]))
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (filter === 'mine') return posts.filter((p) => p.userId === user?.id)
    if (filter === 'friends') return posts.filter((p) => p.userId !== user?.id)
    return posts
  }, [posts, filter, user])

  const groups = useMemo(() => {
    const map = new Map()
    filtered.forEach((p) => {
      const k = formatDateGroup(p.createdAt)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(p)
    })
    return [...map.entries()]
  }, [filtered])

  const del = async (id) => {
    if (!confirm('Xóa moment này?')) return
    try {
      await api.deleteMoment(id)
      toast('Đã xóa')
      setOpen(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div className="px-4 md:px-0 max-w-4xl mx-auto pb-4">
      <h1 className="font-display font-extrabold text-2xl mb-1">Lịch sử</h1>
      <p className="text-sm text-slate-500 mb-4">Moment vuông · nhóm theo ngày</p>

      <div className="flex gap-2 mb-5 no-scrollbar overflow-x-auto">
        {[
          ['all', 'Tất cả'],
          ['mine', 'Của tôi'],
          ['friends', 'Bạn bè'],
        ].map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap press ${
              filter === k
                ? 'dio-gradient text-white shadow-[var(--shadow-dio)]'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon="🗂"
          title="Chưa có moment"
          desc="Camera là nơi bắt đầu."
          action={
            <Link to="/app/upload" className="inline-flex px-5 py-2.5 rounded-2xl dio-gradient text-white text-sm font-bold press">
              Mở camera
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([day, items]) => (
            <div key={day}>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{day}</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setOpen(p)}
                    className="aspect-square rounded-2xl overflow-hidden bg-slate-200 press shadow-sm"
                  >
                    {p.type === 'video' ? (
                      <video src={p.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                    ) : (
                      <img src={p.mediaUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title="Moment">
        {open && (
          <div className="space-y-3">
            <div className="aspect-square rounded-2xl overflow-hidden">
              {open.type === 'video' ? (
                <video src={open.mediaUrl} className="w-full h-full object-cover" controls playsInline />
              ) : (
                <img src={open.mediaUrl} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Avatar user={open.user} size="sm" />
              <div>
                <p className="text-sm font-bold">{open.user?.displayName}</p>
                <p className="text-xs text-slate-400">{timeAgo(open.createdAt)}</p>
              </div>
            </div>
            {open.caption && <p className="text-sm text-slate-600">{open.caption}</p>}
            <div className="flex gap-2">
              {open.userId === user?.id && (
                <>
                  <a
                    href={open.mediaUrl}
                    download
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold flex items-center justify-center gap-1"
                  >
                    <Download size={14} /> Tải
                  </a>
                  <button
                    type="button"
                    onClick={() => del(open.id)}
                    className="flex-1 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-bold flex items-center justify-center gap-1"
                  >
                    <Trash2 size={14} /> Xóa
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
