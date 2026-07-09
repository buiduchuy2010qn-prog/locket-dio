import { useState } from 'react'
import { useApp } from '../context/AppContext'
import * as api from '../api/mockApi'
import { load } from '../utils/storage'
import { DEMO_ACCOUNTS } from '../data/mockData'

export default function AdminDebug() {
  const { user, refreshUser, toast, activateGold } = useApp()
  const [dump, setDump] = useState('')

  const showStorage = () => {
    const keys = ['users', 'posts', 'friends', 'requests', 'notifications', 'streaks', 'sessionUserId', 'seeded']
    const data = {}
    keys.forEach((k) => { data[k] = load(k) })
    setDump(JSON.stringify(data, null, 2))
  }

  const reset = async () => {
    if (!confirm('Xóa toàn bộ mock data & seed lại?')) return
    await api.resetDemoData()
    toast('Đã reset demo data — đăng nhập lại')
    window.location.href = '/login'
  }

  return (
    <div className="px-4 md:px-0 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-extrabold">Admin / Mock debug</h1>
      <p className="text-sm text-slate-500">Trang nội bộ để kiểm tra state & seed data. Không phải production admin thật.</p>

      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-sm space-y-1">
        <p><strong>User:</strong> {user?.email} (@{user?.username})</p>
        <p><strong>Gold:</strong> {String(!!user?.isGold)} · plan {user?.plan || '—'}</p>
        <p><strong>Theme cam:</strong> {user?.cameraTheme} · icon {user?.appIcon}</p>
        <p><strong>Badge:</strong> {user?.badgeStyle} visible={String(user?.badgeVisible)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => activateGold('monthly')} className="px-3 py-2 rounded-xl gold-gradient text-white text-xs font-bold">Force Gold</button>
        <button type="button" onClick={async () => { await api.cancelGoldSubscription(); await refreshUser(); toast('Gold off') }} className="px-3 py-2 rounded-xl border text-xs font-bold">Force Free</button>
        <button type="button" onClick={showStorage} className="px-3 py-2 rounded-xl border text-xs font-bold">Dump localStorage</button>
        <button type="button" onClick={reset} className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold">Reset seed</button>
        <button type="button" onClick={() => refreshUser()} className="px-3 py-2 rounded-xl border text-xs font-bold">Refresh user</button>
      </div>

      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border text-xs">
        <p className="font-bold mb-2">Demo accounts</p>
        {DEMO_ACCOUNTS.map((a) => (
          <p key={a.email}>{a.email} / {a.password} — {a.note}</p>
        ))}
      </div>

      {dump && (
        <pre className="p-4 rounded-2xl bg-slate-900 text-amber-100 text-[10px] overflow-auto max-h-96 custom-scroll">{dump}</pre>
      )}
    </div>
  )
}
