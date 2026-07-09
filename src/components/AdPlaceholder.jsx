import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function AdPlaceholder() {
  const { user } = useApp()
  const nav = useNavigate()
  if (user?.isGold || user?.adFree) return null

  return (
    <div className="mx-4 md:mx-0 my-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 p-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Sponsored · Free plan</p>
        <p className="text-sm text-slate-600 dark:text-slate-300 truncate">Gợi ý: Nâng Gold để tắt quảng cáo</p>
      </div>
      <button
        type="button"
        onClick={() => nav('/app/gold')}
        className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full gold-gradient text-white"
      >
        Gỡ ads
      </button>
    </div>
  )
}
