import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Image as ImageIcon, Video, Lock, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'
import * as api from '../api/mockApi'
import { CAMERA_THEMES, FREE_VIDEO_MAX_SEC, GOLD_VIDEO_MAX_SEC } from '../data/constants'

export default function Upload() {
  const { user, toast, openUpgrade } = useApp()
  const nav = useNavigate()
  const camRef = useRef(null)
  const fileRef = useRef(null)
  const videoRef = useRef(null)

  const [preview, setPreview] = useState(null)
  const [type, setType] = useState('image')
  const [caption, setCaption] = useState('')
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [success, setSuccess] = useState(false)

  const theme = CAMERA_THEMES.find((t) => t.id === (user?.cameraTheme || 'soft-pink')) || CAMERA_THEMES[0]
  const maxVideo = user?.isGold ? GOLD_VIDEO_MAX_SEC : FREE_VIDEO_MAX_SEC

  const readFile = (file, mediaType) => {
    if (!file) return
    if (mediaType === 'video') {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => {
        const d = Math.round(v.duration || 0)
        setDuration(d)
        if (d > maxVideo) {
          toast(`Video ${d}s vượt giới hạn ${maxVideo}s`, 'error')
          if (!user?.isGold) openUpgrade('Longer videos', `Gold cho phép video tới ${GOLD_VIDEO_MAX_SEC}s.`)
        }
        setPreview(url)
        setType('video')
      }
      v.src = url
    } else {
      const reader = new FileReader()
      reader.onload = () => {
        setPreview(reader.result)
        setType('image')
        setDuration(0)
      }
      reader.readAsDataURL(file)
    }
  }

  const onCameraRoll = () => {
    if (!user?.isGold) {
      openUpgrade('Camera roll', 'Tải ảnh/video từ thư viện — chỉ dành cho Piclet Gold.')
      return
    }
    fileRef.current?.click()
  }

  const post = async () => {
    if (!preview) return toast('Chọn ảnh hoặc video trước', 'error')
    if (type === 'video' && duration > maxVideo) {
      return openUpgrade('Longer videos', `Rút ngắn video hoặc nâng Gold (${GOLD_VIDEO_MAX_SEC}s).`)
    }
    setLoading(true)
    setProgress(0)
    const tick = setInterval(() => setProgress((p) => Math.min(92, p + 12)), 120)
    try {
      await api.uploadMoment({
        mediaUrl: preview,
        caption,
        type,
        durationSec: duration,
      })
      setProgress(100)
      setSuccess(true)
      toast('Đã đăng moment!')
      setTimeout(() => nav('/app/feed'), 900)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      clearInterval(tick)
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-[70vh] md:rounded-3xl overflow-hidden ${theme.className}`}>
      <div
        className="px-4 py-6 md:p-8"
        style={{ background: 'var(--cam-bg)' }}
      >
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Upload moment</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Lock size={12} /> Friends only · Theme: {theme.name}
                {user?.isGold && <span className="text-amber-600 font-bold ml-1">Gold video unlocked</span>}
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur border border-white/50 dark:border-slate-700 overflow-hidden shadow-[var(--shadow-card)]">
            <div className="aspect-[4/5] bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center">
              {!preview && (
                <div className="text-center p-6 text-slate-400">
                  <Camera size={40} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Xem trước ảnh / video tại đây</p>
                </div>
              )}
              {preview && type === 'image' && (
                <img src={preview} alt="" className="w-full h-full object-cover" />
              )}
              {preview && type === 'video' && (
                <video ref={videoRef} src={preview} className="w-full h-full object-cover" controls playsInline />
              )}
              {type === 'video' && duration > 0 && (
                <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60 text-white text-xs font-bold">
                  {duration}s / max {maxVideo}s
                </span>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => camRef.current?.click()}
                  className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-sm font-semibold hover:bg-amber-50 active:scale-95 transition"
                >
                  <Camera size={20} style={{ color: 'var(--cam-accent)' }} />
                  Camera
                </button>
                <button
                  type="button"
                  onClick={onCameraRoll}
                  className="relative flex flex-col items-center gap-1 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-sm font-semibold hover:bg-amber-50 active:scale-95 transition"
                >
                  <ImageIcon size={20} />
                  Thư viện
                  {!user?.isGold && (
                    <span className="absolute top-1 right-1 text-[9px] font-bold text-amber-600">🔒 Gold</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'video/*'
                    input.onchange = (e) => readFile(e.target.files?.[0], 'video')
                    input.click()
                  }}
                  className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 text-sm font-semibold hover:bg-amber-50 active:scale-95 transition"
                >
                  <Video size={20} />
                  Video
                </button>
              </div>

              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => readFile(e.target.files?.[0], 'image')} />
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                readFile(f, f.type.startsWith('video') ? 'video' : 'image')
              }} />

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                placeholder="Caption + emoji… ✨"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none"
              />

              {loading && (
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full gold-gradient transition-all duration-200" style={{ width: `${progress}%` }} />
                </div>
              )}

              {success && (
                <div className="text-center py-2 text-emerald-600 font-bold text-sm float-up">
                  <Sparkles className="inline mr-1" size={16} /> Đăng thành công!
                </div>
              )}

              <button
                type="button"
                disabled={loading || !preview}
                onClick={post}
                className="w-full py-3.5 rounded-2xl gold-gradient text-white font-bold shadow-[var(--shadow-gold)] disabled:opacity-50 active:scale-[0.98] transition"
              >
                {loading ? 'Đang đăng…' : 'Đăng moment'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
