import { useState } from 'react'
import { Eye, MoreHorizontal } from 'lucide-react'
import Avatar from './Avatar'
import { timeAgo } from '../utils/storage'
import { BASIC_REACTIONS, GOLD_REACTIONS } from '../data/constants'
import { useApp } from '../context/AppContext'
import * as api from '../api/index.js'
import { SquareMedia } from './SquareFrame'

const ALL_REACTIONS = [...BASIC_REACTIONS, ...GOLD_REACTIONS]

export default function MomentCard({ post, onReact, onOpenInsights, compact }) {
  const { user, toast } = useApp()
  const [picker, setPicker] = useState(false)
  const [local, setLocal] = useState(post)

  const myReaction = Object.entries(local.reactions || {}).find(([, ids]) => ids.includes(user?.id))?.[0]
  const reactionCount = Object.values(local.reactions || {}).reduce((s, a) => s + a.length, 0)
  const seenCount = (local.seenBy || []).length

  const handleReact = async (emoji) => {
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
          </div>
          <p className="text-xs text-slate-400">
            @{local.user?.username} · {timeAgo(local.createdAt)} · Friends only
          </p>
        </div>
        <button type="button" className="p-2 text-slate-400 hover:text-slate-600">
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="px-3 sm:px-4 pb-1">
        <SquareMedia
          src={local.mediaUrl}
          type={local.type === 'video' ? 'video' : 'image'}
          controls={local.type === 'video'}
          className="max-w-full"
        />
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
              onOpenInsights?.(local)
            }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
            title="Seen by"
          >
            <Eye size={14} /> {seenCount}
          </button>
        </div>

        {picker && (
          <div className="absolute z-10 mt-1 p-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-xl flex flex-wrap gap-1 max-w-xs">
            {ALL_REACTIONS.map((e) => (
              <button key={e} type="button" onClick={() => handleReact(e)} className="text-xl p-1.5 hover:scale-125 transition">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
