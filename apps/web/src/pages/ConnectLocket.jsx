import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Shield, Link2, Unlink, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import * as api from '../api/index.js'
import { useApp } from '../context/AppContext'

/**
 * Official Locket Sync settings.
 * Mode A: Official OAuth when credentials exist.
 * Mode B: Honest unavailable + never password.
 */
export default function ConnectLocket() {
  const { toast } = useApp()
  const [params] = useSearchParams()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const s = await api.fetchLocketConnectionStatus()
      setStatus(s)
    } catch (e) {
      setStatus({
        status: 'unavailable',
        available: false,
        officialAvailable: false,
        message:
          e.message ||
          'Official Locket sync is unavailable because Locket does not provide a public official API/OAuth integration.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Complete OAuth if redirected back with code
  useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')
    const err = params.get('error')
    if (err) toast(err, 'error')
    if (!code) return
    setBusy(true)
    api
      .connectLocketAccount({ code, state })
      .then((r) => {
        if (r.ok) toast('Official Locket connected')
        else toast(r.error || 'OAuth incomplete', 'error')
        load()
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setBusy(false))
  }, [params])

  const connect = async () => {
    setBusy(true)
    try {
      const r = await api.connectLocketAccount()
      if (r.authUrl) {
        window.location.href = r.authUrl
        return
      }
      if (!r.ok) toast(r.error || 'Official sync unavailable', 'error')
      else toast('Connected')
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    try {
      await api.disconnectLocketAccount()
      toast('Disconnected / token revoked')
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const available = status?.available ?? status?.officialAvailable

  return (
    <div className="px-4 md:px-0 max-w-xl mx-auto space-y-4 page-enter">
      <h1 className="text-2xl font-extrabold flex items-center gap-2">
        <Link2 className="text-amber-500" /> Official Locket Sync
      </h1>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-4 flex gap-3">
        <Shield className="text-amber-600 shrink-0" size={22} />
        <div className="text-sm text-amber-950 dark:text-amber-50 space-y-1">
          <p className="font-bold">Security & ToS first</p>
          <ul className="list-disc pl-4 text-xs space-y-0.5 opacity-90">
            <li>Never enter your real Locket password on this site</li>
            <li>No private APIs, reverse engineering, or scraping</li>
            <li>Sync only via official OAuth / partner API when Locket provides it</li>
            <li>No fake Gold / bypass of Locket Gold</li>
          </ul>
        </div>
      </div>

      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 shadow-[var(--shadow-soft)]">
        {loading || busy ? (
          <p className="text-sm text-slate-400 flex items-center gap-2">
            <Loader2 className="animate-spin" size={16} /> Loading…
          </p>
        ) : (
          <>
            <p className="text-xs font-bold uppercase text-slate-400">Connection status</p>
            <p className="font-extrabold text-lg mt-1 capitalize flex items-center gap-2">
              {status?.status === 'connected' ? (
                <CheckCircle2 className="text-emerald-500" size={20} />
              ) : (
                <AlertTriangle className="text-amber-500" size={20} />
              )}
              {status?.status || 'unknown'}
            </p>
            <p className="text-sm text-slate-500 mt-2">{status?.message}</p>
            <p className="text-xs text-slate-400 mt-1">
              Mode: <strong>{status?.mode || (available ? 'official_api' : 'export_only')}</strong>
            </p>

            {!available && (
              <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-sm">
                <p className="font-semibold mb-1">You can still use Locket Dio</p>
                <p className="text-slate-500 text-xs">
                  Capture square 1:1 moments, share with friends here, then export / post manually in the official Locket
                  app. We will never claim an unofficial sync succeeded.
                </p>
                <Link to="/app/upload" className="inline-block mt-3 text-sm font-bold text-amber-600">
                  → Open camera
                </Link>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={connect}
                disabled={!available}
                className="px-4 py-2.5 rounded-xl gold-gradient text-white text-sm font-bold disabled:opacity-40 active:scale-95"
              >
                Connect Official Locket Account
              </button>
              <button
                type="button"
                onClick={disconnect}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold flex items-center gap-1 active:scale-95"
              >
                <Unlink size={14} /> Disconnect / Revoke
              </button>
            </div>
          </>
        )}
      </div>

      <div className="text-[11px] text-slate-400 space-y-1 font-mono">
        <p>checkOfficialLocketAPIAvailability · startOfficialLocketOAuth</p>
        <p>handleOfficialLocketOAuthCallback · syncMomentToOfficialLocket</p>
        <p>disconnectOfficialLocket · revokeOfficialLocketToken · showOfficialAPIUnavailableFallback</p>
      </div>
    </div>
  )
}
