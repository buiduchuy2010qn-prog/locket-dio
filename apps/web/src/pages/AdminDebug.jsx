import { useState } from 'react'
import { useApp } from '../context/AppContext'
import * as api from '../api/index.js'
import { load } from '../utils/storage'

export default function AdminDebug() {
  const { user, refreshUser, toast, activateGold } = useApp()
  const [dump, setDump] = useState('')

  const showStorage = () => {
    const keys = ['users', 'posts', 'friends', 'requests', 'notifications', 'streaks', 'sessionUserId', 'seeded']
    const data = {}
    keys.forEach((k) => { data[k] = load(k) })
    setDump(JSON.stringify(data, null, 2))
  }

  const clearLocal = async () => {
    if (!confirm('Xóa dữ liệu local (mock) trên trình duyệt này?')) return
    await api.resetDemoData()
    toast('Đã xóa dữ liệu local')
    window.location.href = '/login'
  }

  return (
    <div className="px-4 md:px-0 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-extrabold">Server status / debug</h1>
      <p className="text-sm text-slate-500">Công cụ nội bộ — không hiển thị tài khoản mẫu.</p>

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-sm space-y-1">
        <p><strong>User:</strong> {user?.email} (@{user?.username})</p>
        <p><strong>Gold (in-app):</strong> {String(!!user?.isGold)} · plan {user?.plan || '—'}</p>
        <p><strong>Theme cam:</strong> {user?.cameraTheme} · icon {user?.appIcon}</p>
        <p><strong>Badge:</strong> {user?.badgeStyle} visible={String(user?.badgeVisible)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => activateGold('monthly')} className="px-3 py-2 rounded-xl gold-gradient text-white text-xs font-bold">Force Gold</button>
        <button type="button" onClick={async () => { await api.cancelGoldSubscription(); await refreshUser(); toast('Gold off') }} className="px-3 py-2 rounded-xl border text-xs font-bold">Force Free</button>
        <button type="button" onClick={showStorage} className="px-3 py-2 rounded-xl border text-xs font-bold">Dump localStorage</button>
        <button type="button" onClick={clearLocal} className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold">Clear local data</button>
        <button type="button" onClick={() => refreshUser()} className="px-3 py-2 rounded-xl border text-xs font-bold">Refresh user</button>
      </div>

      {dump && (
        <pre className="p-4 rounded-2xl bg-slate-900 text-amber-100 text-[10px] overflow-auto max-h-96 custom-scroll">{dump}</pre>
      )}
    </div>
  )
}
