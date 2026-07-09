import { useEffect, useState } from 'react'
import { Shield, Link2, Unlink, AlertTriangle } from 'lucide-react'
import * as api from '../api/index.js'
import { useApp } from '../context/AppContext'

export default function ConnectLocket() {
  const { toast } = useApp()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const s = await api.fetchLocketConnectionStatus()
      setStatus(s)
    } catch (e) {
      setStatus({
        status: 'unavailable',
        officialAvailable: false,
        message: e.message || 'Could not load connection status',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const connect = async () => {
    try {
      const r = await api.connectLocketAccount()
      if (r.authUrl) {
        window.location.href = r.authUrl
        return
      }
      if (!r.ok) toast(r.error || 'Not available', 'error')
      else toast('Connected')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const disconnect = async () => {
    try {
      await api.disconnectLocketAccount()
      toast('Disconnected')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  return (
    <div className="px-4 md:px-0 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-extrabold flex items-center gap-2">
        <Link2 className="text-amber-500" /> Connect Locket
      </h1>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-4 flex gap-3">
        <Shield className="text-amber-600 shrink-0" />
        <div className="text-sm text-amber-900 dark:text-amber-100">
          <p className="font-bold">Security first</p>
          <p className="mt-1">
            Locket Dio <strong>never</strong> asks for your Locket password. Connection is only possible through
            official OAuth/API if Locket provides it. We do not scrape or reverse-engineer private endpoints.
          </p>
        </div>
      </div>

      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-[var(--shadow-soft)]">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <p className="text-xs font-bold uppercase text-slate-400">Status</p>
            <p className="font-extrabold text-lg mt-1 capitalize">{status?.status || 'unknown'}</p>
            <p className="text-sm text-slate-500 mt-2">{status?.message}</p>

            {!status?.officialAvailable && (
              <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-sm flex gap-2">
                <AlertTriangle size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <p>
                  Official integration is not configured. You can still use <strong>Locket Dio</strong> as a full
                  independent private photo-sharing platform with its own accounts, friends, and Gold features.
                </p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={connect}
                className="px-4 py-2.5 rounded-xl gold-gradient text-white text-sm font-bold disabled:opacity-50"
                disabled={!status?.officialAvailable}
              >
                Connect via official OAuth
              </button>
              <button
                type="button"
                onClick={disconnect}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold flex items-center gap-1"
              >
                <Unlink size={14} /> Disconnect
              </button>
            </div>
          </>
        )}
      </div>

      <div className="text-xs text-slate-400 space-y-1">
        <p>API helpers: <code>connectLocketAccount</code>, <code>disconnectLocketAccount</code>, <code>fetchLocketConnectionStatus</code>, <code>syncWithLocketOfficialAPI</code></p>
      </div>
    </div>
  )
}
