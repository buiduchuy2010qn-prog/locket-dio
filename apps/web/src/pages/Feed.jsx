import { useEffect, useState } from 'react'
import * as api from '../api/index.js'
import MomentCard from '../components/MomentCard'
import AdPlaceholder from '../components/AdPlaceholder'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { useApp } from '../context/AppContext'

export default function Feed() {
  const { user } = useApp()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState(null)

  useEffect(() => {
    setLoading(true)
    api.fetchFeed().then((p) => {
      setPosts(p)
      setLoading(false)
      p.slice(0, 5).forEach((x) => api.markSeen(x.id))
    })
  }, [])

  return (
    <div className="px-3 md:px-0 max-w-xl mx-auto space-y-4">
      <div className="hidden md:flex items-center justify-between pt-1">
        <div>
          <h1 className="text-2xl font-extrabold">Feed</h1>
          <p className="text-sm text-slate-500">Moment mới từ circle của bạn</p>
        </div>
        <Link to="/app/upload" className="px-4 py-2 rounded-xl gold-gradient text-white text-sm font-bold">
          + Upload
        </Link>
      </div>

      <AdPlaceholder />

      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-800">
              <div className="p-4 flex gap-3"><div className="skeleton w-11 h-11 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-3 w-1/4" /></div></div>
              <div className="skeleton aspect-square rounded-none" />
            </div>
          ))}
        </div>
      )}

      {!loading && posts.length === 0 && (
        <EmptyState
          icon="📸"
          title="Chưa có moment nào"
          desc="Thêm bạn bè hoặc đăng moment đầu tiên của bạn."
          action={
            <Link to="/app/upload" className="inline-flex px-4 py-2 rounded-xl gold-gradient text-white text-sm font-bold">
              Đăng moment
            </Link>
          }
        />
      )}

      {posts.map((p, i) => (
        <div key={p.id}>
          <MomentCard post={p} onOpenInsights={setInsights} />
          {i === 1 && <AdPlaceholder />}
        </div>
      ))}

      <Modal open={!!insights} onClose={() => setInsights(null)} title="Gold Insights" wide>
        {insights && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Chỉ bạn (chủ moment) thấy được thông tin này.</p>
            <div>
              <h4 className="font-bold text-sm mb-2">Seen by ({insights.seenBy?.length || 0})</h4>
              <div className="flex flex-wrap gap-2">
                {(insights.seenBy || []).map((id) => (
                  <span key={id} className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800">{id}</span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-2">Reactions</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(insights.reactions || {}).map(([e, ids]) => (
                  <span key={e} className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-sm font-medium">
                    {e} {ids.length}
                  </span>
                ))}
                {!Object.keys(insights.reactions || {}).length && (
                  <p className="text-sm text-slate-400">Chưa có reaction</p>
                )}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Weekly recap</p>
              <p className="text-sm mt-1">Bạn đang hoạt động tốt — tiếp tục streak với bạn bè nhé!</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
