import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../context/AppContext'

export default function UpgradeModal() {
  const { upgradeModal, closeUpgrade } = useApp()
  const nav = useNavigate()
  if (!upgradeModal) return null

  return (
    <Modal
      open={!!upgradeModal}
      onClose={closeUpgrade}
      title="Mở khóa với Piclet Gold"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={closeUpgrade}
            className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold text-sm"
          >
            Để sau
          </button>
          <button
            type="button"
            onClick={() => {
              closeUpgrade()
              nav('/app/gold')
            }}
            className="flex-1 py-3 rounded-xl gold-gradient text-white font-bold text-sm shadow-[var(--shadow-gold)]"
          >
            Nâng cấp Gold
          </button>
        </div>
      }
    >
      <div className="text-center py-2">
        <div className="w-16 h-16 mx-auto rounded-2xl gold-gradient flex items-center justify-center text-white mb-4 gold-pulse">
          <Sparkles size={28} />
        </div>
        <p className="font-bold text-slate-900 dark:text-white text-lg mb-1">
          {upgradeModal.feature || 'Tính năng Premium'}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {upgradeModal.message}
        </p>
      </div>
    </Modal>
  )
}
