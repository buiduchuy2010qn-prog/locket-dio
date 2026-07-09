import { useEffect, useMemo, useState } from 'react'
import * as api from '../api/mockApi'
import { useApp } from '../context/AppContext'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Avatar from '../components/Avatar'
import { formatDateGroup, timeAgo } from '../utils/storage'
import { Download, Trash2 } from 'lucide-react'

export default function Gallery() {
  const { user, toast } = useApp()
  const [posts, setPosts] = useState([])
  const [filter, setFilter] = useState('all') // all | mine | friends
  const [open, setOpen] = useState(null)

  const load = () => api.fetchGallery().then(setPosts)
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

  const download = (p) => {
    if (p.userId !== user?.id) return toast('Chỉ tải moment của bạn', 'error')
    const a = document.createElement('a')
    a.href = p.mediaUrl
    a.download = `piclet-${p.id}.jpg`
    a.target = '_blank'
    a.click()
  }

  return (
    <div className="px-4 md:px-0 max-w-4xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-1">Gallery</h1>
      <p className="text-sm text-slate-500 mb-4">Lịch sử moment · nhóm theo ngày</p>

      <div className="flex gap-2 mb-4 no-scrollbar overflow-x-auto">
        {[
          ['all', 'Tất cả'],
          ['mine', 'Của tôi'],
          ['friends', 'Bạn bè'],
        ].map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
              filter === k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="🖼️" title="Gallery trống" desc="Moment bạn đăng hoặc từ bạn bè sẽ hiện tại đây." />
      ) : (
        groups.map(([day, items]) => (
          <div key={day} className="mb-8">
            <h2 className="font-bold text-sm text-slate-500 mb-3 sticky top-14 lg:top-0 bg-transparent py-1">{day}</h2>
            {/* Desktop grid / mobile compact */}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5 md:gap-3">
              {items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setOpen(p)}
                  className="relative aspect-square rounded-xl md:rounded-2xl overflow-hidden group bg-slate-100"
                >
                  <img src={p.mediaUrl} alt="" className="w-full h-full object-cover md:group-hover:scale-105 transition duration-300" />
                  <div className="absolute inset-x-0 bottom-0 p-1.5 md:p-2 bg-gradient-to-t from-black/60 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition">
                    <p className="text-[10px] md:text-xs text-white truncate">@{p.user?.username}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      <Modal open={!!open} onClose={() => setOpen(null)} title="Moment" wide>
        {open && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Avatar user={open.user} size="sm" />
              <div>
                <p className="font-bold text-sm">{open.user?.displayName}</p>
                <p className="text-xs text-slate-400">{timeAgo(open.createdAt)}</p>
              </div>
            </div>
            <img src={open.mediaUrl} alt="" className="w-full rounded-2xl max-h-[60vh] object-contain bg-slate-100" />
            {open.caption && <p className="text-sm">{open.caption}</p>}
            {open.userId === user?.id && (
              <div className="flex gap-2">
                <button type="button" onClick={() => download(open)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold flex items-center justify-center gap-1">
                  <Download size={16} /> Tải về
                </button>
                <button type="button" onClick={() => del(open.id)} className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold flex items-center justify-center gap-1">
                  <Trash2 size={16} /> Xóa
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
