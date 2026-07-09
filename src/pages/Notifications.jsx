import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { timeAgo } from '../utils/storage'
import EmptyState from '../components/EmptyState'
import { Bell, UserPlus, Flame, Heart, Crown, Image } from 'lucide-react'

const icons = {
  friend_request: UserPlus,
  moment: Image,
  reaction: Heart,
  streak: Flame,
  gold: Crown,
}

export default function Notifications() {
  const { notifications, refreshNotifications, markRead, markAllRead, toast } = useApp()

  useEffect(() => {
    refreshNotifications()
  }, [refreshNotifications])

  return (
    <div className="px-4 md:px-0 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold">Notifications</h1>
        <button
          type="button"
          onClick={async () => { await markAllRead(); toast('Đã đọc tất cả') }}
          className="text-xs font-bold text-amber-600"
        >
          Đánh dấu đã đọc
        </button>
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="mx-auto opacity-40" />} title="Im lặng quá" desc="Chưa có thông báo mới." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = icons[n.type] || Bell
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={`w-full text-left p-4 rounded-2xl border flex gap-3 transition ${
                  n.read
                    ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                    : 'bg-amber-50/80 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/20'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm">{n.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{n.body}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-rose-500 mt-2 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
