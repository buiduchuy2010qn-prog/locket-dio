import { useApp } from '../context/AppContext'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

export default function ToastStack() {
  const { toasts } = useApp()
  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm md:ml-auto">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto float-up rounded-2xl px-4 py-3 shadow-lg text-sm font-medium flex items-center gap-2 ${
            t.type === 'error'
              ? 'bg-red-600 text-white'
              : t.type === 'info'
                ? 'bg-slate-800 text-white'
                : 'bg-emerald-600 text-white'
          }`}
        >
          {t.type === 'error' ? <AlertCircle size={16} /> : t.type === 'info' ? <Info size={16} /> : <CheckCircle2 size={16} />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
