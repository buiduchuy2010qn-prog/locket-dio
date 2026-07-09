import { useEffect, useState } from 'react'
import {
  Download, Copy, Share2, QrCode, Smartphone, X, CheckCircle2, Image as ImageIcon,
} from 'lucide-react'
import * as api from '../../api/index.js'
import { useApp } from '../../context/AppContext'

/**
 * Flow 1+2: Saved on Locket Dio + safe export to post manually on official Locket.
 * Never claims unofficial auto-sync.
 */
export default function PostSuccessModal({ open, onClose, moment, mediaUrl, caption }) {
  const { toast } = useApp()
  const [qrOpen, setQrOpen] = useState(false)
  const [step, setStep] = useState(1)

  useEffect(() => {
    if (open) {
      setQrOpen(false)
      setStep(1)
    }
  }, [open])

  if (!open) return null

  const logExport = async (action, meta = {}) => {
    try {
      await api.logLocketExport?.({ momentId: moment?.id, action, meta })
    } catch { /* offline */ }
  }

  const download = async () => {
    await logExport('download')
    const a = document.createElement('a')
    a.href = mediaUrl
    a.download = `locket-dio-${Date.now()}.jpg`
    a.click()
    toast('Đã tải ảnh vuông 1:1')
    setStep(2)
  }

  const copyCaption = async () => {
    await logExport('copy_caption')
    try {
      await navigator.clipboard.writeText(caption || '')
      toast('Đã copy caption')
    } catch {
      toast('Copy thủ công: ' + (caption || ''), 'info')
    }
  }

  const shareNative = async () => {
    await logExport('share')
    if (navigator.share) {
      try {
        // Try share file if data URL
        if (mediaUrl?.startsWith('data:')) {
          const res = await fetch(mediaUrl)
          const blob = await res.blob()
          const file = new File([blob], 'moment.jpg', { type: blob.type || 'image/jpeg' })
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Locket Dio', text: caption || '' })
            setStep(2)
            return
          }
        }
        await navigator.share({
          title: 'Locket Dio',
          text: caption || 'Moment 1:1 từ Locket Dio',
          url: mediaUrl?.startsWith('http') ? mediaUrl : undefined,
        })
        setStep(2)
      } catch { /* cancel */ }
    } else {
      toast('Trình duyệt không hỗ trợ Share — dùng Tải xuống', 'info')
    }
  }

  const openQr = async () => {
    await logExport('qr')
    setQrOpen(true)
    setStep(2)
  }

  const manualGuide = async () => {
    await logExport('manual_instruction')
    setStep(3)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-t-[1.75rem] sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-2 rounded-t-[1.75rem]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">Locket Dio</p>
            <h3 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="text-emerald-500" size={20} /> Đã lưu moment
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Vuông 1:1 · circle của bạn</p>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center active:scale-90">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {mediaUrl && (
            <div className="mx-auto w-40 aspect-square rounded-2xl overflow-hidden shadow-lg ring-2 ring-indigo-200">
              <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-800">Đã lưu trên Locket Dio.</strong>
            {' '}Bạn có thể tải / share để đăng tay ở app khác nếu muốn.
          </div>

          <div className="flex gap-2 text-[10px] font-bold">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`flex-1 h-1.5 rounded-full ${step >= n ? 'bg-indigo-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {step === 1 && 'Bước 1 — Lấy ảnh/video từ Dio'}
            {step === 2 && 'Bước 2 — Chuyển sang điện thoại'}
            {step === 3 && 'Bước 3 — Mở app Locket & đăng'}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={download}
              className="flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 transition"
            >
              <Download className="text-indigo-600" size={22} />
              <span className="text-xs font-bold text-slate-800">Tải xuống 1:1</span>
            </button>
            <button
              type="button"
              onClick={shareNative}
              className="flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 transition"
            >
              <Share2 className="text-indigo-600" size={22} />
              <span className="text-xs font-bold text-slate-800">Share điện thoại</span>
            </button>
            <button
              type="button"
              onClick={copyCaption}
              className="flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 transition"
            >
              <Copy className="text-indigo-600" size={22} />
              <span className="text-xs font-bold text-slate-800">Copy caption</span>
            </button>
            <button
              type="button"
              onClick={openQr}
              className="flex flex-col items-center gap-1.5 p-4 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 transition"
            >
              <QrCode className="text-indigo-600" size={22} />
              <span className="text-xs font-bold text-slate-800">QR → điện thoại</span>
            </button>
          </div>

          {qrOpen && (
            <div className="p-4 rounded-2xl bg-slate-50 text-center space-y-2">
              <p className="text-xs text-slate-600 font-medium">Quét QR trên điện thoại để mở / tải media</p>
              {mediaUrl?.startsWith('http') ? (
                <img
                  alt="QR"
                  className="mx-auto w-44 h-44 rounded-xl bg-white p-2 shadow"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mediaUrl)}`}
                />
              ) : (
                <p className="text-xs text-amber-700 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  Ảnh đang lưu local (data URL). Dùng <strong>Tải xuống</strong> hoặc <strong>Share</strong> trên mobile browser.
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={manualGuide}
            className="w-full py-3.5 rounded-2xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95"
          >
            <Smartphone size={18} />
            Hướng dẫn dùng moment
          </button>

          {step === 3 && (
            <ol className="text-sm text-slate-600 space-y-2 p-4 rounded-2xl bg-indigo-50 border border-indigo-100 list-decimal pl-8">
              <li>Moment đã nằm trong circle Locket Dio</li>
              <li>Tải / share sang điện thoại nếu cần</li>
              <li>Bạn bè có thể react & xem feed Dio</li>
              <li>Bạn kiểm soát 100% nội dung</li>
            </ol>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold active:scale-95"
            >
              Xong
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl dio-gradient text-white text-sm font-bold active:scale-95 flex items-center justify-center gap-1"
            >
              <ImageIcon size={16} /> Chụp tiếp
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
