import { useEffect, useState } from 'react'
import * as api from '../api/index.js'
import MomentCard from '../components/MomentCard'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { Link } from 'react-router-dom'
import { Camera } from 'lucide-react'

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.fetchFeed()
      .then((p) => {
        const list = Array.isArray(p) ? p : []
        setPosts(list)
        list.slice(0, 5).forEach((x) => api.markSeen(x.id).catch(() => {}))
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-3 md:px-0 max-w-xl mx-auto space-y-4 pb-4">
      <div className="hidden md:flex items-center justify-between pt-1">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Feed</h1>
          <p className="text-sm text-slate-500">Moment mới từ circle</p>
        </div>
        <Link
          to="/app/upload"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl dio-gradient text-white text-sm font-bold shadow-[var(--shadow-dio)] press"
        >
          <Camera size={16} /> Camera
        </Link>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card-surface overflow-hidden">
              <div className="p-4 flex gap-3">
                <div className="skeleton w-11 h-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-1/3" />
                  <div className="skeleton h-3 w-1/4" />
                </div>
              </div>
              <div className="skeleton aspect-square rounded-none" />
            </div>
          ))}
        </div>
      )}

      {!loading && posts.length === 0 && (
        <EmptyState
          icon="📷"
          title="Feed trống"
          desc="Thêm bạn bè hoặc đăng moment đầu tiên."
          action={
            <Link to="/app/upload" className="inline-flex px-5 py-2.5 rounded-2xl dio-gradient text-white text-sm font-bold press">
              Mở camera
            </Link>
          }
        />
      )}

      {posts.map((p) => (
        <MomentCard key={p.id} post={p} onOpenInsights={setInsights} />
      ))}

      <Modal open={!!insights} onClose={() => setInsights(null)} title="Insights">
        {insights && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Chỉ bạn (chủ moment) thấy được.</p>
            <div>
              <h4 className="font-bold text-sm mb-2">Seen by ({insights.seenBy?.length || 0})</h4>
              <div className="flex flex-wrap gap-2">
                {(insights.seenBy || []).map((id) => (
                  <span key={id} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800">{id}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-2">Reactions</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(insights.reactions || {}).map(([e, ids]) => (
                  <span key={e} className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-sm font-medium">
                    {e} {ids.length}
                  </span>
                ))}
                {!Object.keys(insights.reactions || {}).length && (
                  <p className="text-sm text-slate-400">Chưa có reaction</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
