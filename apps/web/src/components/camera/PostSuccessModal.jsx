import { useEffect, useMemo, useState } from 'react'
import { Download, Copy, Share2, QrCode, ExternalLink, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import * as api from '../../api/index.js'

/**
 * After post: official sync status OR honest export/manual fallback.
 * Never claims unofficial sync succeeded.
 */
export default function PostSuccessModal({ open, onClose, moment, mediaUrl, caption, syncResult }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState('')
  const [qrOpen, setQrOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    api.fetchLocketConnectionStatus?.()
      .then(setStatus)
      .catch(() =>
        setStatus({
          available: false,
          officialAvailable: false,
          status: 'unavailable',
          message:
            'Official Locket sync is unavailable because Locket does not provide a public official API/OAuth integration.',
        }),
      )
  }, [open])

  const officialAvailable = status?.available ?? status?.officialAvailable
  const syncStatus = syncResult?.status || (officialAvailable ? 'not_connected' : 'skipped_unavailable')

  const statusUi = useMemo(() => {
    const map = {
      synced: { label: 'Synced successfully', color: 'text-emerald-600', icon: CheckCircle2 },
      uploading: { label: 'Uploading to Locket…', color: 'text-amber-600', icon: Loader2 },
      connected: { label: 'Connected', color: 'text-emerald-600', icon: CheckCircle2 },
      not_connected: { label: 'Not connected', color: 'text-slate-500', icon: AlertTriangle },
      failed: { label: 'Sync failed', color: 'text-red-600', icon: AlertTriangle },
      skipped_unavailable: { label: 'Official sync unavailable', color: 'text-amber-700', icon: AlertTriangle },
      unavailable: { label: 'Official sync unavailable', color: 'text-amber-700', icon: AlertTriangle },
    }
    return map[syncStatus] || map.skipped_unavailable
  }, [syncStatus])

  if (!open) return null

  const logExport = async (action, meta = {}) => {
    try {
      await api.logLocketExport?.({ momentId: moment?.id, action, meta })
    } catch { /* offline ok */ }
  }

  const download = async () => {
    setBusy('download')
    await logExport('download')
    const a = document.createElement('a')
    a.href = mediaUrl
    a.download = `locket-dio-${moment?.id || Date.now()}.jpg`
    a.click()
    setBusy('')
  }

  const copyCaption = async () => {
    setBusy('copy')
    await logExport('copy_caption')
    try {
      await navigator.clipboard.writeText(caption || '')
    } catch { /* */ }
    setBusy('')
  }

  const shareNative = async () => {
    setBusy('share')
    await logExport('share')
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Locket Dio moment',
          text: caption || 'My square moment',
          url: mediaUrl?.startsWith('http') ? mediaUrl : undefined,
        })
      } catch { /* cancelled */ }
    }
    setBusy('')
  }

  const Icon = statusUi.icon

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="font-extrabold text-lg">Posted to Locket Dio ✓</h3>
            <p className={`text-sm font-semibold mt-1 flex items-center gap-1.5 ${statusUi.color}`}>
              <Icon size={16} className={syncStatus === 'uploading' ? 'animate-spin' : ''} />
              {statusUi.label}
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl border flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        {mediaUrl && (
          <div className="aspect-square rounded-2xl overflow-hidden mb-4 bg-slate-100">
            <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {!officialAvailable || syncStatus === 'skipped_unavailable' || syncStatus === 'unavailable' ? (
          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
              <strong>Official Locket sync is unavailable</strong> because Locket does not provide a public official
              API/OAuth integration. You can still use Locket Dio independently.
            </div>
            <p className="text-xs text-slate-500 font-semibold uppercase">Export / manual post</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={download} className="flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold hover:bg-slate-50 active:scale-95">
                <Download size={16} /> Download
              </button>
              <button type="button" onClick={copyCaption} className="flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold hover:bg-slate-50 active:scale-95">
                <Copy size={16} /> Copy caption
              </button>
              <button type="button" onClick={shareNative} className="flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold hover:bg-slate-50 active:scale-95">
                <Share2 size={16} /> Share
              </button>
              <button
                type="button"
                onClick={async () => {
                  await logExport('qr')
                  setQrOpen(true)
                }}
                className="flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold hover:bg-slate-50 active:scale-95"
              >
                <QrCode size={16} /> QR to phone
              </button>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logExport('manual_instruction')
                alert('Open the official Locket app on your phone and post this media manually. Locket Dio never pretends unofficial posts were synced.')
              }}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900 text-white text-sm font-bold active:scale-95"
            >
              <ExternalLink size={16} /> Open Locket app & post manually
            </button>
            {qrOpen && (
              <div className="p-3 rounded-2xl bg-slate-50 text-center text-xs text-slate-600">
                QR: open this device’s download / share the image to your phone, then post in Locket.
                {mediaUrl?.startsWith('http') && (
                  <img
                    alt="QR"
                    className="mx-auto mt-2 w-40 h-40"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(mediaUrl)}`}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-slate-600">
              {syncResult?.message || 'Connect Official Locket via OAuth to sync (never enter your Locket password here).'}
            </p>
            {syncStatus === 'not_connected' && (
              <a href="/app/connect-locket" className="inline-flex px-4 py-2 rounded-xl gold-gradient text-white text-sm font-bold">
                Connect Official Locket
              </a>
            )}
            {syncStatus === 'failed' && (
              <button
                type="button"
                className="px-4 py-2 rounded-xl border text-sm font-semibold"
                onClick={async () => {
                  try {
                    const r = await api.syncMomentToOfficialLocket?.(moment?.id)
                    if (r) setStatus((s) => ({ ...s, lastResult: r }))
                  } catch { /* */ }
                }}
              >
                Retry official sync
              </button>
            )}
          </div>
        )}

        <button type="button" onClick={onClose} className="mt-4 w-full py-3 rounded-xl border font-semibold text-sm">
          Done
        </button>
        {busy && <p className="text-center text-xs text-slate-400 mt-2">{busy}…</p>}
      </div>
    </div>
  )
}
