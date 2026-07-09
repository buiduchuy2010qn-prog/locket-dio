import { useApp } from '../context/AppContext'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

export default function ToastStack() {
  const { toasts } = useApp()
  if (!toasts?.length) return null

  return (
    <div className="fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4 safe-pt">
      {toasts.map((t) => {
        const Icon = t.type === 'error' ? AlertCircle : t.type === 'info' ? Info : CheckCircle2
        const color =
          t.type === 'error'
            ? 'border-rose-200 bg-rose-50 text-rose-800'
            : t.type === 'info'
              ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl border shadow-lg text-sm font-semibold backdrop-blur-md ${color} page-enter`}
          >
            <Icon size={16} />
            {t.message}
          </div>
        )
      })}
    </div>
  )
}
