import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import * as api from '../api/index.js'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { useApp } from '../context/AppContext'
import { timeAgo } from '../utils/storage'

export default function Streaks() {
  const { user, toast, openUpgrade } = useApp()
  const [list, setList] = useState([])
  const [restore, setRestore] = useState(null)

  const load = () => api.fetchStreaks().then(setList)
  useEffect(() => { load() }, [])

  const doRestore = async () => {
    if (!restore) return
    if (!user?.isGold) {
      openUpgrade('Restore streak', 'Chỉ Piclet Gold mới khôi phục streak đã lỡ.')
      return
    }
    try {
      await api.restoreStreak(restore.friendId)
      toast('Đã khôi phục streak! 🔥')
      setRestore(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div className="px-4 md:px-0 max-w-xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-1 flex items-center gap-2">
        <Flame className="text-orange-500" /> Streaks
      </h1>
      <p className="text-sm text-slate-500 mb-5">Chuỗi ngày đăng moment với từng người bạn</p>

      {list.length === 0 ? (
        <EmptyState icon="🔥" title="Chưa có streak" desc="Đăng moment và tương tác với bạn bè để bắt đầu." />
      ) : (
        <div className="space-y-3">
          {list.map((s) => (
            <div key={s.friendId} className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-3">
                <Avatar user={s.user} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{s.user?.displayName}</p>
                  <p className="text-xs text-slate-400">
                    {s.lastPostAt ? `Lần cuối ${timeAgo(s.lastPostAt)}` : 'Chưa có activity'}
                    {s.broken ? ' · Đã đứt' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-orange-500">🔥 {s.count}</p>
                  <p className="text-[10px] text-slate-400">ngày</p>
                </div>
              </div>
              <div className="flex gap-1 mt-3">
                {(s.history || []).map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 h-2 rounded-full ${h ? 'bg-orange-400' : 'bg-slate-200 dark:bg-slate-700'}`}
                    title={h ? 'Posted' : 'Missed'}
                  />
                ))}
              </div>
              {(s.broken || s.count === 0) && (
                <button
                  type="button"
                  onClick={() => setRestore(s)}
                  className={`mt-3 w-full py-2 rounded-xl text-xs font-bold ${
                    user?.isGold
                      ? 'gold-gradient text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {user?.isGold ? 'Khôi phục streak' : '🔒 Restore streak (Gold)'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!restore}
        onClose={() => setRestore(null)}
        title="Khôi phục streak?"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setRestore(null)} className="flex-1 py-2.5 rounded-xl border font-semibold text-sm">Hủy</button>
            <button type="button" onClick={doRestore} className="flex-1 py-2.5 rounded-xl gold-gradient text-white font-bold text-sm">Xác nhận</button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Khôi phục streak với <strong>{restore?.user?.displayName}</strong>? Tính năng Gold — chỉ dùng khi lỡ một ngày.
        </p>
      </Modal>
    </div>
  )
}
