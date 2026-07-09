import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Image as ImageIcon, Video, Lock, Sparkles, Square } from 'lucide-react'
import { useApp } from '../context/AppContext'
import * as api from '../api/index.js'
import { CAMERA_THEMES, FREE_VIDEO_MAX_SEC, GOLD_VIDEO_MAX_SEC } from '../data/constants'
import SquareFrame from '../components/SquareFrame'
import SquareCropEditor from '../components/SquareCropEditor'
import { exportSquareCrop } from '../utils/squareCrop'

export default function Upload() {
  const { user, toast, openUpgrade } = useApp()
  const nav = useNavigate()
  const camRef = useRef(null)
  const fileRef = useRef(null)
  const liveVideoRef = useRef(null)
  const streamRef = useRef(null)

  const [sourceUrl, setSourceUrl] = useState(null) // original image/video url
  const [type, setType] = useState('image')
  const [caption, setCaption] = useState('')
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [success, setSuccess] = useState(false)
  const [liveCam, setLiveCam] = useState(false)
  const [crop, setCrop] = useState({ zoom: 1, offsetX: 0, offsetY: 0 })

  const theme = CAMERA_THEMES.find((t) => t.id === (user?.cameraTheme || 'soft-pink')) || CAMERA_THEMES[0]
  const maxVideo = user?.isGold ? GOLD_VIDEO_MAX_SEC : FREE_VIDEO_MAX_SEC

  const stopLive = useCallback(() => {
    streamRef.current?.getTracks()?.forEach((t) => t.stop())
    streamRef.current = null
    setLiveCam(false)
  }, [])

  useEffect(() => () => stopLive(), [stopLive])

  const onCropChange = useCallback((c) => {
    setCrop(c)
  }, [])

  const readFile = (file, mediaType) => {
    if (!file) return
    stopLive()
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
        setSourceUrl(url)
        setType('video')
      }
      v.src = url
    } else {
      const reader = new FileReader()
      reader.onload = () => {
        setSourceUrl(reader.result)
        setType('image')
        setDuration(0)
        setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })
      }
      reader.readAsDataURL(file)
    }
  }

  const startLiveCamera = async () => {
    try {
      stopLive()
      setSourceUrl(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', aspectRatio: { ideal: 1 } },
        audio: false,
      })
      streamRef.current = stream
      setLiveCam(true)
      setType('image')
      requestAnimationFrame(() => {
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream
          liveVideoRef.current.play().catch(() => {})
        }
      })
    } catch {
      // fallback: file capture
      camRef.current?.click()
    }
  }

  const captureFromLive = () => {
    const video = liveVideoRef.current
    if (!video || !video.videoWidth) return toast('Camera chưa sẵn sàng', 'error')
    const side = Math.min(video.videoWidth, video.videoHeight)
    const sx = (video.videoWidth - side) / 2
    const sy = (video.videoHeight - side) / 2
    const canvas = document.createElement('canvas')
    const out = 1080
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, sx, sy, side, side, 0, 0, out, out)
    const data = canvas.toDataURL('image/jpeg', 0.92)
    stopLive()
    setSourceUrl(data)
    setType('image')
    setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })
    toast('Đã chụp · chỉnh crop nếu cần')
  }

  const onCameraRoll = () => {
    if (!user?.isGold) {
      openUpgrade('Camera roll', 'Tải ảnh/video từ thư viện — chỉ dành cho Locket Dio Gold.')
      return
    }
    fileRef.current?.click()
  }

  const post = async () => {
    if (!sourceUrl && !liveCam) return toast('Chọn hoặc chụp ảnh trước', 'error')
    if (liveCam) return toast('Bấm «Chụp 1:1» trước khi đăng', 'error')
    if (type === 'video' && duration > maxVideo) {
      return openUpgrade('Longer videos', `Rút ngắn video hoặc nâng Gold (${GOLD_VIDEO_MAX_SEC}s).`)
    }
    setLoading(true)
    setProgress(0)
    const tick = setInterval(() => setProgress((p) => Math.min(92, p + 12)), 120)
    try {
      let mediaUrl = sourceUrl
      if (type === 'image') {
        // Export perfect square crop (frame size used for pan was display width — scale offsets)
        const frameEl = document.querySelector('[data-square-crop-root]')
        const displaySize = frameEl?.clientWidth || 360
        const scale = 1080 / displaySize
        mediaUrl = await exportSquareCrop(sourceUrl, {
          frameSize: 1080,
          zoom: crop.zoom || 1,
          offsetX: (crop.offsetX || 0) * scale,
          offsetY: (crop.offsetY || 0) * scale,
          mime: 'image/jpeg',
          quality: 0.92,
        })
      }
      await api.uploadMoment({
        mediaUrl,
        caption,
        type,
        durationSec: duration,
      })
      setProgress(100)
      setSuccess(true)
      toast('Đã đăng moment vuông 1:1!')
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
      <div className="px-3 py-5 sm:px-4 md:p-8" style={{ background: 'var(--cam-bg)' }}>
        <div className="max-w-md mx-auto md:max-w-lg">
          <div className="mb-4 text-center md:text-left">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center justify-center md:justify-start gap-2">
              <Square size={22} className="text-amber-600" /> Upload moment
            </h1>
            <p className="text-xs text-slate-500 flex items-center justify-center md:justify-start gap-1 mt-0.5 flex-wrap">
              <Lock size={12} /> Friends only · <strong className="text-amber-700">1:1 square</strong> · {theme.name}
              {user?.isGold && <span className="text-amber-600 font-bold">· Gold video</span>}
            </p>
          </div>

          {/* Centered square camera / crop panel */}
          <div className="rounded-[1.75rem] bg-white/70 dark:bg-slate-900/75 backdrop-blur-xl border border-white/60 dark:border-white/10 p-3 sm:p-4 shadow-[var(--shadow-card)]">
            <div data-square-crop-root className="w-full max-w-[min(100%,420px)] mx-auto">
              {/* Live camera */}
              {liveCam && (
                <div className="space-y-3">
                  <SquareFrame showSafeGuide>
                    <video
                      ref={liveVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </SquareFrame>
                  <button
                    type="button"
                    onClick={captureFromLive}
                    className="w-full py-3 rounded-2xl gold-gradient text-white font-bold shadow-[var(--shadow-gold)]"
                  >
                    Chụp 1:1
                  </button>
                </div>
              )}

              {/* Image crop editor */}
              {!liveCam && sourceUrl && type === 'image' && (
                <SquareCropEditor src={sourceUrl} onChange={onCropChange} />
              )}

              {/* Video square preview */}
              {!liveCam && sourceUrl && type === 'video' && (
                <SquareFrame showSafeGuide>
                  <video src={sourceUrl} className="w-full h-full object-cover" controls playsInline />
                  {duration > 0 && (
                    <span className="absolute top-3 right-3 z-30 px-2 py-1 rounded-full bg-black/60 text-white text-xs font-bold">
                      {duration}s / max {maxVideo}s
                    </span>
                  )}
                </SquareFrame>
              )}

              {/* Empty state square */}
              {!liveCam && !sourceUrl && (
                <SquareFrame showSafeGuide>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                    <Camera size={40} className="mb-2 opacity-40" />
                    <p className="text-sm font-medium">Khung camera 1:1</p>
                    <p className="text-xs opacity-70 mt-1">Chụp hoặc chọn ảnh vuông</p>
                  </div>
                </SquareFrame>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={startLiveCamera}
                  className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800 text-sm font-semibold hover:bg-amber-50 active:scale-95 transition"
                >
                  <Camera size={20} style={{ color: 'var(--cam-accent)' }} />
                  Camera
                </button>
                <button
                  type="button"
                  onClick={onCameraRoll}
                  className="relative flex flex-col items-center gap-1 py-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800 text-sm font-semibold hover:bg-amber-50 active:scale-95 transition"
                >
                  <ImageIcon size={20} />
                  Thư viện
                  {!user?.isGold && (
                    <span className="absolute top-1 right-1 text-[9px] font-bold text-amber-600">🔒</span>
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
                  className="flex flex-col items-center gap-1 py-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800 text-sm font-semibold hover:bg-amber-50 active:scale-95 transition"
                >
                  <Video size={20} />
                  Video
                </button>
              </div>

              {/* hidden inputs — also allow non-live file camera */}
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => readFile(e.target.files?.[0], 'image')}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  readFile(f, f.type.startsWith('video') ? 'video' : 'image')
                }}
              />

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
                  <Sparkles className="inline mr-1" size={16} /> Đăng thành công (1:1)!
                </div>
              )}

              <button
                type="button"
                disabled={loading || (!sourceUrl && !liveCam)}
                onClick={post}
                className="w-full py-3.5 rounded-2xl gold-gradient text-white font-bold shadow-[var(--shadow-gold)] disabled:opacity-50 active:scale-[0.98] transition"
              >
                {loading ? 'Đang đăng…' : 'Đăng moment 1:1'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
