import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} aria-label="Đóng" />
      <div
        className={`relative w-full ${wide ? 'max-w-lg' : 'max-w-md'} bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto page-enter`}
      >
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur">
          <h3 className="font-display font-bold text-lg">{title}</h3>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center press">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
