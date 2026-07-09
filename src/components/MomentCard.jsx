import { useState } from 'react'
import { Eye, MoreHorizontal } from 'lucide-react'
import Avatar from './Avatar'
import { GoldPill } from './GoldBadge'
import { timeAgo } from '../utils/storage'
import { BASIC_REACTIONS, GOLD_REACTIONS } from '../data/constants'
import { useApp } from '../context/AppContext'
import * as api from '../api/mockApi'

export default function MomentCard({ post, onReact, onOpenInsights, compact }) {
  const { user, openUpgrade, toast } = useApp()
  const [picker, setPicker] = useState(false)
  const [local, setLocal] = useState(post)

  const myReaction = Object.entries(local.reactions || {}).find(([, ids]) => ids.includes(user?.id))?.[0]
  const reactionCount = Object.values(local.reactions || {}).reduce((s, a) => s + a.length, 0)
  const seenCount = (local.seenBy || []).length

  const handleReact = async (emoji, isGoldOnly) => {
    if (isGoldOnly && !user?.isGold) {
      openUpgrade('Gold Reactions', 'Mở khóa reaction premium & hiệu ứng động với Piclet Gold.')
      return
    }
    try {
      const updated = await api.reactToMoment(local.id, emoji)
      setLocal({ ...local, ...updated })
      onReact?.(updated)
      setPicker(false)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <article
      className={`bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-[var(--shadow-soft)] overflow-hidden transition hover:shadow-[var(--shadow-card)] ${
        compact ? '' : 'md:hover:scale-[1.01]'
      }`}
    >
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <Avatar user={local.user} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {local.user?.displayName || local.user?.username}
            </span>
            {local.user?.isGold && local.user?.badgeVisible !== false && <GoldPill />}
          </div>
          <p className="text-xs text-slate-400">
            @{local.user?.username} · {timeAgo(local.createdAt)} · Friends only
          </p>
        </div>
        <button type="button" className="p-2 text-slate-400 hover:text-slate-600">
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="relative bg-slate-100 dark:bg-slate-800 aspect-[4/5] sm:aspect-square max-h-[70vh]">
        {local.type === 'video' ? (
          <video src={local.mediaUrl} className="w-full h-full object-cover" controls playsInline />
        ) : (
          <img src={local.mediaUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        )}
      </div>

      <div className="p-3 sm:p-4 space-y-2">
        {local.caption && (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            <span className="font-semibold mr-1">{local.user?.username}</span>
            {local.caption}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 relative">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => setPicker((v) => !v)}
              className="px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 text-sm font-medium hover:bg-amber-50 dark:hover:bg-slate-700 transition active:scale-95"
            >
              {myReaction || '😊'} React{reactionCount ? ` · ${reactionCount}` : ''}
            </button>
            {Object.entries(local.reactions || {}).slice(0, 4).map(([emoji, ids]) => (
              <span key={emoji} className="text-xs bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-full">
                {emoji} {ids.length}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (local.userId !== user?.id) return
              if (!user?.isGold) {
                openUpgrade('Gold Insights', 'Xem ai đã xem moment của bạn với Piclet Gold.')
                return
              }
              onOpenInsights?.(local)
            }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
            title="Seen by"
          >
            <Eye size={14} /> {seenCount}
            {local.userId === user?.id && !user?.isGold && <span className="text-amber-500">🔒</span>}
          </button>
        </div>

        {picker && (
          <div className="absolute z-10 mt-1 p-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl flex flex-wrap gap-1 max-w-xs">
            {BASIC_REACTIONS.map((e) => (
              <button key={e} type="button" onClick={() => handleReact(e, false)} className="text-xl p-1.5 hover:scale-125 transition">
                {e}
              </button>
            ))}
            <div className="w-full border-t border-slate-100 dark:border-slate-700 my-1 pt-1 flex flex-wrap gap-1">
              <span className="w-full text-[10px] font-bold text-amber-600 px-1">Gold</span>
              {GOLD_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => handleReact(e, true)}
                  className={`text-xl p-1.5 hover:scale-125 transition ${!user?.isGold ? 'opacity-40 grayscale' : ''}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
