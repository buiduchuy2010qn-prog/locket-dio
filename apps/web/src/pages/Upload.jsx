import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, MessageCircle, Grid3X3, SwitchCamera, Zap, ZapOff,
  Images, MoreHorizontal, Send, Video, Camera,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import * as api from '../api/index.js'
import { GOLD_VIDEO_MAX_SEC } from '../data/constants'
import SquareFrame from '../components/SquareFrame'
import SquareCropEditor from '../components/SquareCropEditor'
import { exportSquareCrop } from '../utils/squareCrop'
import GlassBtn, { FriendsPill } from '../components/camera/GlassBtn'
import PostSuccessModal from '../components/camera/PostSuccessModal'
import Avatar from '../components/Avatar'
import { timeAgo } from '../utils/storage'

export default function Upload() {
  const { user, toast, unreadCount } = useApp()
  const nav = useNavigate()

  const [screen, setScreen] = useState('camera')
  // Photo first — video recording enables mic only when user presses record
  const [captureKind, setCaptureKind] = useState('photo')
  // Desktop webcams: prefer front camera (user). Mobile: environment.
  const [facing, setFacing] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
      ? 'user'
      : 'user',
  )
  const [flash, setFlash] = useState(false)
  const [friendsLabel, setFriendsLabel] = useState('Tất cả bạn bè')

  const [sourceUrl, setSourceUrl] = useState(null)
  const [type, setType] = useState('image')
  const [caption, setCaption] = useState('')
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(false)
  const [crop, setCrop] = useState({ zoom: 1, offsetX: 0, offsetY: 0 })
  const [posts, setPosts] = useState([])
  const [selected, setSelected] = useState(null)
  const [msg, setMsg] = useState('')
  const [audience, setAudience] = useState('FRIENDS')
  const [postResult, setPostResult] = useState(null)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false,
  )
  const [recording, setRecording] = useState(false)
  const [recSec, setRecSec] = useState(0)
  const [camReady, setCamReady] = useState(false)
  const [camError, setCamError] = useState('')
  const [camBusy, setCamBusy] = useState(false)

  const liveRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const recTimerRef = useRef(null)
  const recordingRef = useRef(false)
  const startGenRef = useRef(0)
  const maxVideo = GOLD_VIDEO_MAX_SEC

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const fn = () => {
      setIsDesktop(mq.matches)
      // Prefer front cam on desktop
      if (mq.matches) setFacing((f) => (f === 'environment' ? 'user' : f))
    }
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  useEffect(() => {
    api.fetchFriends()
      .then((f) => setFriendsLabel(f.length > 0 ? `${f.length} Bạn bè` : 'Tất cả bạn bè'))
      .catch(() => {})
  }, [])

  const loadHistory = useCallback(() => {
    api.fetchGallery('all').then(setPosts).catch(() => setPosts([]))
  }, [])

  useEffect(() => {
    if (screen === 'history') loadHistory()
  }, [screen, loadHistory])

  const stopRecorderOnly = useCallback(() => {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current)
      recTimerRef.current = null
    }
    recordingRef.current = false
    setRecording(false)
    setRecSec(0)
  }, [])

  const stopLive = useCallback(() => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.ondataavailable = null
        recorderRef.current.onstop = null
        recorderRef.current.stop()
      }
    } catch { /* ignore */ }
    recorderRef.current = null
    stopRecorderOnly()
    streamRef.current?.getTracks()?.forEach((t) => t.stop())
    streamRef.current = null
    setCamReady(false)
  }, [stopRecorderOnly])

  const explainCamError = (err) => {
    const name = err?.name || ''
    const msg = String(err?.message || '')
    if (!window.isSecureContext && !/localhost|127\.0\.0\.1/i.test(window.location.hostname)) {
      return 'Camera cần HTTPS (hoặc localhost). Hãy dùng https:// hoặc Thư viện.'
    }
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Bạn đã chặn quyền camera. Bấm biểu tượng 🔒 trên thanh địa chỉ → Cho phép Camera → Thử lại.'
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'Không tìm thấy webcam. Cắm camera hoặc dùng Thư viện.'
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Camera đang bị app khác dùng (Zoom/Meet…). Đóng app đó rồi Thử lại.'
    }
    if (name === 'OverconstrainedError') {
      return 'Webcam không hỗ trợ chế độ này. Đang thử lại…'
    }
    if (name === 'SecurityError') {
      return 'Trình duyệt chặn camera (cần HTTPS). Dùng Thư viện hoặc mở bằng https.'
    }
    return msg || 'Không mở được camera — thử Thư viện'
  }

  /** Preview always video-only. Audio is added only when recording. */
  const requestVideoStream = async (facingMode) => {
    const attempts = [
      // simplest — highest success on desktop Chrome
      { video: true, audio: false },
      { video: { facingMode: { ideal: facingMode || 'user' } }, audio: false },
      { video: { facingMode: facingMode || 'user' }, audio: false },
      {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
    ]

    let lastErr
    for (const constraints of attempts) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const s = await navigator.mediaDevices.getUserMedia(constraints)
        return s
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr || new Error('getUserMedia failed')
  }

  const waitForVideoEl = () =>
    new Promise((resolve) => {
      let n = 0
      const tick = () => {
        if (liveRef.current) resolve(liveRef.current)
        else if (n++ > 40) resolve(null)
        else requestAnimationFrame(tick)
      }
      tick()
    })

  const attachStream = async (stream) => {
    streamRef.current = stream
    const el = await waitForVideoEl()
    if (!el) {
      setCamError('Không gắn được preview. Bấm Thử lại.')
      return false
    }
    // Reset before assign (Chrome quirk)
    el.srcObject = null
    el.muted = true
    el.defaultMuted = true
    el.playsInline = true
    el.setAttribute('playsinline', 'true')
    el.setAttribute('webkit-playsinline', 'true')
    el.autoplay = true
    el.srcObject = stream

    await new Promise((resolve) => {
      const done = () => resolve()
      if (el.readyState >= 1) done()
      else {
        el.onloadedmetadata = done
        setTimeout(done, 1200)
      }
    })

    try {
      await el.play()
    } catch {
      try {
        await el.play()
      } catch (e) {
        console.warn('[camera] play()', e)
      }
    }

    // Confirm we actually have frames
    const track = stream.getVideoTracks()[0]
    if (!track || track.readyState === 'ended') {
      setCamError('Camera tắt ngay sau khi mở. Thử lại hoặc Thư viện.')
      return false
    }
    setCamReady(true)
    setCamError('')
    return true
  }

  const startLive = useCallback(async () => {
    const gen = ++startGenRef.current
    setCamBusy(true)
    setCamError('')
    setCamReady(false)

    const host = window.location.hostname || ''
    if (!window.isSecureContext && !/localhost|127\.0\.0\.1/i.test(host)) {
      setCamError('Camera cần HTTPS. Mở https://… hoặc dùng Thư viện.')
      setCamBusy(false)
      return null
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Trình duyệt không hỗ trợ camera — dùng Thư viện')
      setCamBusy(false)
      return null
    }

    try {
      // Stop previous tracks unless recording
      if (!recordingRef.current) {
        streamRef.current?.getTracks()?.forEach((t) => t.stop())
        streamRef.current = null
      }

      const stream = await requestVideoStream(facing)
      if (gen !== startGenRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return null
      }

      const ok = await attachStream(stream)
      if (!ok || gen !== startGenRef.current) {
        if (gen !== startGenRef.current) stream.getTracks().forEach((t) => t.stop())
        return null
      }
      return stream
    } catch (err) {
      console.warn('[camera]', err?.name, err?.message, err)
      if (gen === startGenRef.current) {
        setCamReady(false)
        setCamError(explainCamError(err))
      }
      return null
    } finally {
      if (gen === startGenRef.current) setCamBusy(false)
    }
  }, [facing])

  // Start camera only when entering camera screen / flip facing — NOT when toggling photo/video
  useEffect(() => {
    if (screen !== 'camera' || sourceUrl) {
      if (screen !== 'camera' || sourceUrl) {
        if (!recordingRef.current) stopLive()
      }
      return undefined
    }
    if (recordingRef.current) return undefined

    let cancelled = false
    const t = window.setTimeout(() => {
      if (!cancelled) startLive()
    }, 100)

    return () => {
      cancelled = true
      window.clearTimeout(t)
      // Do NOT stop stream on React StrictMode re-run mid-start;
      // generation token invalidates stale attaches. Full stop on unmount below.
    }
  }, [screen, facing, sourceUrl, startLive, stopLive])

  // Full cleanup when leaving upload page
  useEffect(() => () => {
    startGenRef.current += 1
    stopLive()
  }, [stopLive])

  const capturePhoto = () => {
    const video = liveRef.current
    if (!video?.videoWidth) return toast('Camera chưa sẵn sàng — Thử lại hoặc Thư viện', 'error')
    const side = Math.min(video.videoWidth, video.videoHeight)
    const sx = (video.videoWidth - side) / 2
    const sy = (video.videoHeight - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1080
    const ctx = canvas.getContext('2d')
    // Mirror front camera so capture matches preview
    if (facing === 'user') {
      ctx.translate(1080, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, sx, sy, side, side, 0, 0, 1080, 1080)
    stopLive()
    setSourceUrl(canvas.toDataURL('image/jpeg', 0.9))
    setType('image')
    setDuration(0)
    setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })
    setScreen('compose')
  }

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try { rec.stop() } catch { /* ignore */ }
    }
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current)
      recTimerRef.current = null
    }
    recordingRef.current = false
    setRecording(false)
  }, [])

  const startRecording = async () => {
    try {
      let stream = streamRef.current
      if (!stream || stream.getVideoTracks().every((t) => t.readyState !== 'live')) {
        stream = await startLive()
      }
      if (!stream || typeof MediaRecorder === 'undefined') {
        return toast('Không quay được — mở camera hoặc dùng Thư viện', 'error')
      }

      // Optional mic — don't fail whole recording if mic denied
      try {
        if (!stream.getAudioTracks().length) {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          mic.getAudioTracks().forEach((t) => stream.addTrack(t))
        }
      } catch {
        /* video-only recording ok */
      }

      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
        .find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
      chunksRef.current = []
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = rec
      rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'video/webm' })
        if (!blob.size) return toast('Video rỗng', 'error')
        const url = URL.createObjectURL(blob)
        const v = document.createElement('video')
        v.onloadedmetadata = () => {
          setDuration(Math.round(v.duration) || recSec || 1)
          setSourceUrl(url)
          setType('video')
          setScreen('compose')
          stopLive()
        }
        v.onerror = () => {
          setDuration(recSec || 1)
          setSourceUrl(url)
          setType('video')
          setScreen('compose')
          stopLive()
        }
        v.src = url
      }
      rec.start(250)
      recordingRef.current = true
      setRecording(true)
      setRecSec(0)
      recTimerRef.current = setInterval(() => {
        setRecSec((s) => {
          if (s + 1 >= maxVideo) stopRecording()
          return s + 1
        })
      }, 1000)
    } catch {
      toast('Quay video thất bại', 'error')
    }
  }

  const onShutter = () => {
    if (captureKind === 'photo') capturePhoto()
    else if (recordingRef.current) stopRecording()
    else startRecording()
  }

  const readFile = (file, mediaType) => {
    if (!file) return
    stopLive()
    if (mediaType === 'video') {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      v.onloadedmetadata = () => {
        setDuration(Math.round(v.duration) || 1)
        setSourceUrl(url)
        setType('video')
        setScreen('compose')
      }
      v.src = url
    } else {
      const r = new FileReader()
      r.onload = () => {
        setSourceUrl(r.result)
        setType('image')
        setDuration(0)
        setScreen('compose')
      }
      r.readAsDataURL(file)
    }
  }

  const onCropChange = useCallback((c) => setCrop(c), [])

  const post = async () => {
    if (!sourceUrl) return
    if (type === 'video' && duration > maxVideo) return toast(`Video tối đa ${maxVideo}s`, 'error')
    setLoading(true)
    try {
      let mediaUrl = sourceUrl
      if (type === 'image') {
        const displaySize = document.querySelector('[data-square-crop-root]')?.clientWidth || 360
        const scale = 1080 / displaySize
        mediaUrl = await exportSquareCrop(sourceUrl, {
          frameSize: 1080,
          zoom: crop.zoom || 1,
          offsetX: (crop.offsetX || 0) * scale,
          offsetY: (crop.offsetY || 0) * scale,
        })
      }
      const result = await api.uploadMoment({
        mediaUrl, caption, type, durationSec: duration, visibility: audience,
      })
      toast('Đã lưu moment!')
      setPostResult({ moment: result, mediaUrl: result.mediaUrl || mediaUrl, caption })
      setSourceUrl(null)
      setCaption('')
      loadHistory()
    } catch (e) {
      toast(e.message || 'Đăng thất bại', 'error')
    } finally {
      setLoading(false)
    }
  }

  const btnVariant = isDesktop ? 'light' : 'dark'

  const TopChrome = ({ dark }) => (
    <div className="absolute top-0 inset-x-0 z-40 safe-pt px-4 pt-3 flex items-center justify-between gap-2 pointer-events-none">
      <div className="pointer-events-auto">
        <GlassBtn size="md" variant={dark ? 'dark' : 'light'} label="Hồ sơ" onClick={() => nav('/app/profile')}>
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <User size={20} />
          )}
        </GlassBtn>
      </div>
      <div className="pointer-events-auto">
        <FriendsPill text={friendsLabel} variant={dark ? 'dark' : 'light'} onClick={() => nav('/app/friends')} />
      </div>
      <div className="pointer-events-auto relative">
        <GlassBtn size="md" variant={dark ? 'dark' : 'light'} label="Chat" onClick={() => nav('/app/chat')}>
          <MessageCircle size={20} />
        </GlassBtn>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>
    </div>
  )

  /* ── HISTORY ── */
  if (screen === 'history') {
    return (
      <div className={`fixed inset-0 z-30 ${isDesktop ? 'bg-white' : 'bg-[#0c1222]'} page-enter`}>
        <TopChrome dark={!isDesktop} />
        <div className={`pt-20 px-3 pb-32 max-w-2xl mx-auto ${isDesktop ? '' : ''}`}>
          <h1 className={`text-center font-display font-bold mb-5 ${isDesktop ? 'text-slate-800' : 'text-white'}`}>
            Lịch sử
          </h1>
          {posts.length === 0 ? (
            <p className={`text-center text-sm py-20 ${isDesktop ? 'text-slate-400' : 'text-white/40'}`}>
              Chưa có moment
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {posts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setSelected(p); setScreen('detail') }}
                  className="aspect-square rounded-2xl overflow-hidden bg-slate-800 press"
                >
                  {p.type === 'video' ? (
                    <video src={p.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={p.mediaUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="fixed bottom-10 inset-x-0 z-40 flex justify-center">
          <button
            type="button"
            onClick={() => { setSourceUrl(null); setScreen('camera') }}
            className="w-16 h-16 rounded-full bg-white border-[5px] border-indigo-300 shadow-xl press flex items-center justify-center"
          >
            <span className="w-11 h-11 rounded-full border-[3px] border-slate-900/70" />
          </button>
        </div>
      </div>
    )
  }

  /* ── DETAIL ── */
  if (screen === 'detail' && selected) {
    return (
      <div className={`fixed inset-0 z-30 flex flex-col ${isDesktop ? 'bg-white' : 'bg-[#0c1222]'} page-enter`}>
        <TopChrome dark={!isDesktop} />
        <div className="flex-1 flex flex-col justify-center px-4 pt-16 pb-4 max-w-md mx-auto w-full">
          <div className="relative">
            <SquareFrame>
              {selected.type === 'video' ? (
                <video src={selected.mediaUrl} className="w-full h-full object-cover" controls playsInline />
              ) : (
                <img src={selected.mediaUrl} alt="" className="w-full h-full object-cover" />
              )}
            </SquareFrame>
            <span className="absolute bottom-3 left-3 z-30 px-2.5 py-1 rounded-full bg-black/50 text-white text-[11px] font-semibold backdrop-blur-sm">
              {timeAgo(selected.createdAt)}
            </span>
          </div>
          <div className="flex items-center gap-2.5 mt-3">
            <Avatar user={selected.user} size="sm" />
            <div className="min-w-0">
              <p className={`font-bold text-sm truncate ${isDesktop ? 'text-slate-900' : 'text-white'}`}>
                {selected.user?.displayName || selected.user?.username}
              </p>
              <p className={`text-xs ${isDesktop ? 'text-slate-400' : 'text-white/45'}`}>{timeAgo(selected.createdAt)}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {['💛', '😍', '🔥', '✨'].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => api.reactToMoment(selected.id, e).then(() => toast(`React ${e}`)).catch((err) => toast(err.message, 'error'))}
                className="w-11 h-11 rounded-full glass-dark text-lg press border border-white/10"
              >
                {e}
              </button>
            ))}
          </div>
          <div className={`mt-3 flex items-center gap-2 rounded-full px-3.5 py-2.5 border ${
            isDesktop ? 'bg-slate-50 border-slate-200' : 'glass-dark border-white/10'
          }`}>
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Gửi tin nhắn..."
              className={`flex-1 bg-transparent text-sm outline-none ${isDesktop ? 'text-slate-800' : 'text-white placeholder:text-white/35'}`}
            />
            <button type="button" onClick={() => { if (msg.trim()) { toast('Đã gửi'); setMsg('') } }} className="text-indigo-400 press">
              <Send size={18} />
            </button>
          </div>
        </div>
        <div className="safe-pb pb-5 px-10 flex items-center justify-between max-w-md mx-auto w-full">
          <GlassBtn size="md" variant={btnVariant} label="Lưới" onClick={() => setScreen('history')}>
            <Grid3X3 size={20} />
          </GlassBtn>
          <button
            type="button"
            onClick={() => { setSelected(null); setSourceUrl(null); setScreen('camera') }}
            className="w-16 h-16 rounded-full bg-white border-[5px] border-indigo-300 shadow-xl press"
          >
            <span className="block w-11 h-11 mx-auto rounded-full border-[3px] border-slate-900/70" />
          </button>
          <GlassBtn size="md" variant={btnVariant} label="Thêm" onClick={() => nav('/app/gallery')}>
            <MoreHorizontal size={20} />
          </GlassBtn>
        </div>
      </div>
    )
  }

  /* ── COMPOSE ── */
  if (screen === 'compose' && sourceUrl) {
    return (
      <div className={`fixed inset-0 z-30 flex flex-col page-enter ${
        isDesktop ? 'bg-white' : 'bg-gradient-to-b from-[#121a2e] via-[#0c1222] to-black'
      }`}>
        <TopChrome dark={!isDesktop} />
        <div className="flex-1 flex flex-col justify-center px-4 pt-16 pb-6 max-w-md mx-auto w-full overflow-y-auto">
          <div data-square-crop-root>
            {type === 'image' ? (
              <SquareCropEditor src={sourceUrl} onChange={onCropChange} />
            ) : (
              <SquareFrame showSafeGuide>
                <video src={sourceUrl} className="w-full h-full object-cover" controls playsInline />
              </SquareFrame>
            )}
          </div>
          {type === 'video' && (
            <p className={`mt-2 text-xs font-semibold ${isDesktop ? 'text-slate-500' : 'text-white/50'}`}>
              Video · {duration}s / max {maxVideo}s
            </p>
          )}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            placeholder="Thêm caption..."
            className={`mt-3 w-full rounded-2xl px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-indigo-400 ${
              isDesktop
                ? 'bg-slate-50 border border-slate-200'
                : 'bg-white/10 border border-white/10 text-white placeholder:text-white/35'
            }`}
          />
          <div className="mt-3 flex gap-2">
            {[
              ['FRIENDS', 'Tất cả bạn bè'],
              ['CLOSE_FRIENDS', 'Close friends'],
            ].map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setAudience(v)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold press ${
                  audience === v
                    ? 'dio-gradient text-white'
                    : isDesktop
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-white/10 text-white/70 border border-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => { setSourceUrl(null); setScreen('camera') }}
              className={`flex-1 py-3 rounded-2xl font-semibold text-sm press ${
                isDesktop ? 'border border-slate-200' : 'bg-white/10 text-white border border-white/10'
              }`}
            >
              Chụp lại
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={post}
              className="flex-1 py-3.5 rounded-2xl dio-gradient text-white font-bold text-sm press disabled:opacity-50 shadow-[var(--shadow-dio)]"
            >
              {loading ? 'Đang đăng…' : 'Đăng moment'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── CAMERA ── */
  return (
    <div
      className={`page-enter ${
        isDesktop
          ? 'min-h-dvh bg-white relative flex flex-col'
          : 'fixed inset-0 z-30 bg-gradient-to-b from-[#152038] via-[#0e1628] to-[#070b14] flex flex-col'
      }`}
    >
      <TopChrome dark={!isDesktop} />

      <div className={`flex-1 flex flex-col items-center justify-center px-4 ${isDesktop ? 'pt-10 pb-10' : 'pt-16 pb-6'}`}>
        {/* Mode chips */}
        <div className="mb-3 flex flex-col items-center gap-2 z-20">
          <div className={`inline-flex p-1 rounded-full border ${
            isDesktop ? 'bg-slate-100 border-slate-200' : 'bg-white/10 border-white/15'
          }`}>
            <button
              type="button"
              className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                isDesktop ? 'bg-white shadow text-slate-900' : 'bg-white text-slate-900'
              }`}
            >
              Camera
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                isDesktop ? 'text-slate-500' : 'text-white/65'
              }`}
            >
              Thư viện
            </button>
          </div>
          <div className={`inline-flex p-1 rounded-full border ${
            isDesktop ? 'bg-slate-100 border-slate-200' : 'bg-white/10 border-white/15'
          }`}>
            {[
              { id: 'photo', label: 'Ảnh', Icon: Camera },
              { id: 'video', label: 'Video', Icon: Video },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                disabled={recording}
                onClick={() => setCaptureKind(id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 press ${
                  captureKind === id
                    ? isDesktop ? 'bg-white shadow text-slate-900' : 'bg-white text-slate-900'
                    : isDesktop ? 'text-slate-500' : 'text-white/65'
                }`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className={`relative w-full ${isDesktop ? 'max-w-[400px]' : 'max-w-[min(100%,400px)]'}`}>
          <SquareFrame showSafeGuide className="!rounded-[2rem]">
            <video
              ref={liveRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
            />
            {(camBusy || (!camReady && !camError)) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#0c1222]/92 text-white/70 text-sm font-medium">
                <span className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Đang mở camera…
              </div>
            )}
            {!camBusy && !camReady && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0c1222] text-white text-sm p-5 text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-1">
                  <Video size={28} className="text-white/50" />
                </div>
                <p className="text-white/85 text-[13px] leading-relaxed max-w-[92%] font-medium">
                  {camError || 'Chưa có hình camera'}
                </p>
                <p className="text-white/45 text-[11px] max-w-[90%]">
                  Cho phép Camera trong 🔒 thanh địa chỉ · Tắt Zoom/Meet nếu đang bật
                </p>
                <button
                  type="button"
                  onClick={() => startLive()}
                  className="px-5 py-2.5 rounded-full dio-gradient text-white text-xs font-bold press shadow-[var(--shadow-dio)]"
                >
                  Bật camera / Thử lại
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-5 py-2.5 rounded-full bg-white text-slate-900 text-xs font-bold press"
                >
                  Chọn từ Thư viện
                </button>
              </div>
            )}
          </SquareFrame>

          {recording && (
            <div className="absolute top-3 inset-x-0 z-30 flex justify-center">
              <span className="px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                REC {String(Math.floor(recSec / 60)).padStart(2, '0')}:{String(recSec % 60).padStart(2, '0')}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setFlash((f) => !f)}
            className={`absolute top-3 left-3 z-30 w-10 h-10 rounded-full flex items-center justify-center border press ${
              isDesktop ? 'bg-white/95 border-slate-200 text-slate-800' : 'glass-dark text-white'
            }`}
          >
            {flash ? <Zap size={18} className="text-amber-400" /> : <ZapOff size={18} />}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setScreen('history')}
          className={`mt-4 text-sm font-semibold press ${isDesktop ? 'text-slate-400 hover:text-slate-700' : 'text-white/70'}`}
        >
          Lịch sử
        </button>

        <div className="mt-6 w-full max-w-sm flex items-center justify-between px-1">
          <GlassBtn size="md" variant={btnVariant} label="Lịch sử" onClick={() => setScreen('history')}>
            <Images size={20} />
          </GlassBtn>

          <button
            type="button"
            onClick={onShutter}
            className={`relative w-[5.25rem] h-[5.25rem] rounded-full bg-white border-[5px] press shadow-[0_12px_40px_rgba(69,99,245,0.35)] flex items-center justify-center ${
              recording ? 'border-rose-500' : 'border-indigo-400 shutter-ring'
            }`}
            aria-label="Shutter"
          >
            {captureKind === 'video' ? (
              recording ? (
                <span className="w-7 h-7 rounded-md bg-rose-500" />
              ) : (
                <span className="w-12 h-12 rounded-full bg-rose-500" />
              )
            ) : (
              <span className="w-12 h-12 rounded-full border-[3px] border-slate-900/75" />
            )}
          </button>

          <GlassBtn
            size="md"
            variant={btnVariant}
            label="Lật camera"
            onClick={() => {
              if (!recording) setFacing((f) => (f === 'environment' ? 'user' : 'environment'))
            }}
          >
            <SwitchCamera size={20} />
          </GlassBtn>
        </div>

        <p className={`mt-4 text-[11px] font-medium ${isDesktop ? 'text-slate-400' : 'text-white/40'}`}>
          {captureKind === 'photo'
            ? 'Chạm nút để chụp 1:1'
            : recording
              ? 'Chạm lại để dừng'
              : `Chạm để quay (tối đa ${maxVideo}s)`}
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (!f) return
          readFile(f, f.type.startsWith('video') ? 'video' : 'image')
          e.target.value = ''
        }}
      />

      <PostSuccessModal
        open={!!postResult}
        onClose={() => { setPostResult(null); setScreen('camera') }}
        moment={postResult?.moment}
        mediaUrl={postResult?.mediaUrl}
        caption={postResult?.caption}
      />
    </div>
  )
}
