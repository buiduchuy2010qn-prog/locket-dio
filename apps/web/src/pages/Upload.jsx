import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, MessageCircle, Grid3X3, SwitchCamera, Zap, ZapOff,
  Images, MoreHorizontal, Send, Upload as UploadIcon, Bell, Video, Camera,
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
  const [captureKind, setCaptureKind] = useState('photo')
  const [facing, setFacing] = useState('environment')
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

  const liveRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const recTimerRef = useRef(null)
  const recordingRef = useRef(false)
  const maxVideo = GOLD_VIDEO_MAX_SEC

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const fn = () => setIsDesktop(mq.matches)
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

  useEffect(() => () => stopLive(), [stopLive])

  const attachStream = useCallback(async (stream) => {
    streamRef.current = stream
    const el = liveRef.current
    if (el) {
      el.srcObject = stream
      try {
        await el.play()
      } catch { /* autoplay policies */ }
    }
    setCamReady(true)
    setCamError('')
  }, [])

  const startLive = useCallback(async (withAudio = false) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Trình duyệt không hỗ trợ camera. Dùng Thư viện.')
      return null
    }
    try {
      // Don't tear down mid-record via this path if already recording
      if (!recordingRef.current) {
        streamRef.current?.getTracks()?.forEach((t) => t.stop())
        streamRef.current = null
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: withAudio,
      })
      await attachStream(stream)
      return stream
    } catch (e) {
      console.error(e)
      setCamReady(false)
      setCamError('Không mở được camera — cho phép quyền camera hoặc dùng Thư viện')
      return null
    }
  }, [facing, attachStream])

  // Start/stop camera when on camera screen
  useEffect(() => {
    if (screen !== 'camera' || sourceUrl) {
      if (screen !== 'camera' || sourceUrl) stopLive()
      return
    }
    if (recordingRef.current) return
    let cancelled = false
    ;(async () => {
      const s = await startLive(captureKind === 'video')
      if (cancelled && s) {
        s.getTracks().forEach((t) => t.stop())
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on screen/facing/kind when not recording
  }, [screen, facing, captureKind, sourceUrl])

  const capturePhoto = async () => {
    const video = liveRef.current
    if (!video?.videoWidth) {
      toast('Camera chưa sẵn sàng — đợi preview hoặc dùng Thư viện', 'error')
      return
    }
    try {
      const side = Math.min(video.videoWidth, video.videoHeight)
      const sx = (video.videoWidth - side) / 2
      const sy = (video.videoHeight - side) / 2
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1080
      canvas.getContext('2d').drawImage(video, sx, sy, side, side, 0, 0, 1080, 1080)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
      stopLive()
      setSourceUrl(dataUrl)
      setType('image')
      setDuration(0)
      setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })
      setScreen('compose')
    } catch (e) {
      toast(e.message || 'Chụp thất bại', 'error')
    }
  }

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop()
      } catch { /* ignore */ }
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
        stream = await startLive(true)
      } else if (!stream.getAudioTracks().length) {
        // re-acquire with audio
        stream = await startLive(true)
      }
      if (!stream) {
        toast('Không mở camera/mic để quay video', 'error')
        return
      }
      if (typeof MediaRecorder === 'undefined') {
        toast('Trình duyệt không hỗ trợ quay video — dùng Thư viện', 'error')
        return
      }

      const mimeCandidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ]
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported?.(m)) || ''
      chunksRef.current = []
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = rec

      rec.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data)
      }
      rec.onerror = () => {
        toast('Lỗi quay video', 'error')
        stopRecording()
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'video/webm' })
        if (!blob.size) {
          toast('Video rỗng — thử lại', 'error')
          stopRecorderOnly()
          return
        }
        const url = URL.createObjectURL(blob)
        const v = document.createElement('video')
        v.preload = 'metadata'
        v.onloadedmetadata = () => {
          let sec = Math.round(v.duration || 0)
          if (!Number.isFinite(sec) || sec <= 0) sec = recSec || 1
          setDuration(sec)
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
          const next = s + 1
          if (next >= maxVideo) {
            stopRecording()
          }
          return next
        })
      }, 1000)
    } catch (e) {
      console.error(e)
      toast('Không quay được video — thử Thư viện', 'error')
    }
  }

  const onShutter = () => {
    if (captureKind === 'photo') {
      capturePhoto()
      return
    }
    if (recordingRef.current) stopRecording()
    else startRecording()
  }

  const readFile = (file, mediaType) => {
    if (!file) return
    stopLive()
    if (mediaType === 'video') {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => {
        setDuration(Math.round(v.duration || 0) || 1)
        setSourceUrl(url)
        setType('video')
        setScreen('compose')
      }
      v.onerror = () => {
        setDuration(1)
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
      r.onerror = () => toast('Không đọc được file', 'error')
      r.readAsDataURL(file)
    }
  }

  const onCropChange = useCallback((c) => setCrop(c), [])

  const post = async () => {
    if (!sourceUrl) return
    if (type === 'video' && duration > maxVideo) {
      return toast(`Video tối đa ${maxVideo}s`, 'error')
    }
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
        mediaUrl,
        caption,
        type,
        durationSec: duration,
        visibility: audience,
        syncOfficial: false,
      })
      toast('Đã lưu moment!')
      setPostResult({
        moment: result,
        mediaUrl: result.mediaUrl || mediaUrl,
        caption,
      })
      setSourceUrl(null)
      setCaption('')
      loadHistory()
    } catch (e) {
      console.error(e)
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
        <FriendsPill
          text={friendsLabel}
          variant={dark ? 'dark' : 'light'}
          onClick={() => nav('/app/friends')}
        />
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

  if (screen === 'history') {
    return (
      <div className={`fixed inset-0 z-30 lg:relative lg:inset-auto lg:min-h-[80vh] ${isDesktop ? 'bg-white' : 'bg-black'} page-enter`}>
        <div className={`relative min-h-full ${isDesktop ? 'max-w-2xl mx-auto' : ''}`}>
          <TopChrome dark={!isDesktop} />
          <div className="pt-20 px-3 pb-28">
            <h1 className={`text-center font-bold mb-4 ${isDesktop ? 'text-slate-800' : 'text-white'}`}>Lịch sử</h1>
            {posts.length === 0 ? (
              <p className={`text-center text-sm py-16 ${isDesktop ? 'text-slate-400' : 'text-white/50'}`}>Chưa có moment — chụp ngay!</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {posts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelected(p); setScreen('detail') }}
                    className="aspect-square rounded-2xl overflow-hidden bg-slate-800 active:scale-95 transition"
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
          <div className="fixed bottom-8 inset-x-0 z-40 flex justify-center lg:bottom-10">
            <GlassBtn
              size="xl"
              variant="solid"
              label="Chụp"
              className="!bg-white border-4 border-slate-200 shadow-2xl"
              onClick={() => { setSourceUrl(null); setScreen('camera') }}
            >
              <span className="w-14 h-14 rounded-full border-[3px] border-slate-800" />
            </GlassBtn>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'detail' && selected) {
    return (
      <div className={`fixed inset-0 z-30 flex flex-col ${isDesktop ? 'bg-white' : 'bg-black'} page-enter`}>
        <TopChrome dark={!isDesktop} />
        <div className="flex-1 flex flex-col justify-center px-4 pt-16 pb-4 max-w-md mx-auto w-full">
          <div className="relative">
            <SquareFrame className="!rounded-[1.75rem]">
              {selected.type === 'video' ? (
                <video src={selected.mediaUrl} className="w-full h-full object-cover" controls playsInline />
              ) : (
                <img src={selected.mediaUrl} alt="" className="w-full h-full object-cover" />
              )}
            </SquareFrame>
            <span className="absolute bottom-3 left-3 z-30 px-2.5 py-1 rounded-full bg-black/55 text-white text-[11px] font-semibold backdrop-blur-sm">
              {timeAgo(selected.createdAt)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Avatar user={selected.user} size="sm" />
            <div className="min-w-0">
              <p className={`font-bold text-sm truncate ${isDesktop ? 'text-slate-900' : 'text-white'}`}>
                {selected.user?.displayName || selected.user?.username}
              </p>
              <p className={`text-xs ${isDesktop ? 'text-slate-400' : 'text-white/50'}`}>{timeAgo(selected.createdAt)}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {['❤️', '😍', '🔥', '✨', '💯'].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => api.reactToMoment(selected.id, e).then(() => toast(`React ${e}`)).catch((err) => toast(err.message, 'error'))}
                className="w-11 h-11 rounded-full bg-white/10 border border-white/15 text-lg active:scale-90 transition backdrop-blur-md"
              >
                {e}
              </button>
            ))}
          </div>
          <div className={`mt-3 flex items-center gap-2 rounded-full px-3 py-2 border ${isDesktop ? 'bg-slate-50 border-slate-200' : 'bg-white/10 border-white/15 backdrop-blur-md'}`}>
            <input
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Gửi tin nhắn..."
              className={`flex-1 bg-transparent text-sm outline-none ${isDesktop ? 'text-slate-800 placeholder:text-slate-400' : 'text-white placeholder:text-white/40'}`}
            />
            <button
              type="button"
              onClick={() => {
                if (!msg.trim()) return
                const peer = selected.userId !== user?.id ? selected.userId : null
                if (peer) {
                  api.sendMessage?.(peer, msg).then(() => { toast('Đã gửi'); setMsg('') }).catch((err) => toast(err.message, 'error'))
                } else {
                  toast('Chọn moment của bạn bè để chat')
                  setMsg('')
                }
              }}
              className="text-amber-400 active:scale-90"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        <div className="safe-pb pb-4 px-8 flex items-center justify-between max-w-md mx-auto w-full">
          <GlassBtn size="md" variant={btnVariant} label="Lịch sử" onClick={() => setScreen('history')}>
            <Grid3X3 size={20} />
          </GlassBtn>
          <GlassBtn size="xl" variant="solid" label="Chụp" onClick={() => { setSelected(null); setSourceUrl(null); setScreen('camera') }}>
            <span className="w-14 h-14 rounded-full border-[3px] border-slate-800" />
          </GlassBtn>
          <GlassBtn size="md" variant={btnVariant} label="Thêm" onClick={() => nav('/app/gallery')}>
            <MoreHorizontal size={20} />
          </GlassBtn>
        </div>
      </div>
    )
  }

  if (screen === 'compose' && sourceUrl) {
    return (
      <div className={`fixed inset-0 z-30 flex flex-col page-enter ${isDesktop ? 'bg-white' : 'bg-gradient-to-b from-[#0a1628] via-[#0c1a2e] to-black'}`}>
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
            <p className={`mt-2 text-xs font-semibold ${isDesktop ? 'text-slate-500' : 'text-white/60'}`}>
              Video · {duration}s (tối đa {maxVideo}s)
            </p>
          )}
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            placeholder="Thêm caption..."
            className={`mt-3 w-full rounded-2xl px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-amber-400 ${
              isDesktop ? 'bg-slate-50 border border-slate-200' : 'bg-white/10 border border-white/15 text-white placeholder:text-white/40 backdrop-blur-md'
            }`}
          />
          <div className="mt-3">
            <p className={`text-xs font-bold mb-1.5 ${isDesktop ? 'text-slate-500' : 'text-white/60'}`}>Audience</p>
            <div className="flex gap-2">
              {[
                ['FRIENDS', 'Tất cả bạn bè'],
                ['CLOSE_FRIENDS', 'Close friends'],
              ].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAudience(v)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition ${
                    audience === v
                      ? 'gold-gradient text-white'
                      : isDesktop
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-white/10 text-white/80 border border-white/15'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => { setSourceUrl(null); setScreen('camera') }}
              className={`flex-1 py-3 rounded-2xl font-semibold text-sm active:scale-95 ${isDesktop ? 'border border-slate-200' : 'bg-white/10 text-white border border-white/15'}`}
            >
              Chụp lại
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={post}
              className="flex-1 py-3.5 rounded-2xl gold-gradient text-white font-bold text-sm active:scale-95 disabled:opacity-50 shadow-lg"
            >
              {loading ? 'Đang đăng…' : 'Đăng moment'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const cameraShell = isDesktop
    ? 'min-h-[calc(100vh-2rem)] bg-white relative flex flex-col'
    : 'fixed inset-0 z-30 bg-gradient-to-b from-[#0b1526] via-[#0e1c33] to-black flex flex-col'

  return (
    <div className={`${cameraShell} page-enter`}>
      <TopChrome dark={!isDesktop} />

      {isDesktop && (
        <div className="absolute top-4 right-20 z-40 flex gap-2">
          <GlassBtn size="sm" variant="light" label="TB" onClick={() => nav('/app/notifications')}><Bell size={16} /></GlassBtn>
        </div>
      )}

      <div className={`flex-1 flex flex-col items-center justify-center px-4 ${isDesktop ? 'pt-8 pb-8' : 'pt-16 pb-4'}`}>
        <div className="mb-2 z-20">
          <div className={`inline-flex p-1 rounded-full border backdrop-blur-md ${isDesktop ? 'bg-slate-100 border-slate-200' : 'bg-white/10 border-white/20'}`}>
            <button
              type="button"
              className={`px-4 py-1.5 rounded-full text-xs font-bold ${isDesktop ? 'bg-white shadow text-slate-900' : 'bg-white text-slate-900'}`}
            >
              Camera
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`px-4 py-1.5 rounded-full text-xs font-bold ${isDesktop ? 'text-slate-500' : 'text-white/70'}`}
            >
              Thư viện
            </button>
          </div>
        </div>

        <div className="mb-3 z-20">
          <div className={`inline-flex p-1 rounded-full border backdrop-blur-md ${isDesktop ? 'bg-slate-100 border-slate-200' : 'bg-white/10 border-white/20'}`}>
            {[
              { id: 'photo', label: 'Ảnh', Icon: Camera },
              { id: 'video', label: 'Video', Icon: Video },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                disabled={recording}
                onClick={() => setCaptureKind(id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition active:scale-95 flex items-center gap-1 ${
                  captureKind === id
                    ? isDesktop ? 'bg-white shadow text-slate-900' : 'bg-white text-slate-900'
                    : isDesktop ? 'text-slate-500' : 'text-white/70'
                }`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className={`relative w-full ${isDesktop ? 'max-w-[420px]' : 'max-w-[min(100%,420px)]'}`}>
          <SquareFrame showSafeGuide className="!rounded-[1.75rem] sm:!rounded-[2rem]">
            <video
              ref={liveRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {!camReady && !camError && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/80 text-white text-sm">
                Đang mở camera…
              </div>
            )}
            {camError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90 text-white text-sm p-4 text-center gap-3">
                <p>{camError}</p>
                <button
                  type="button"
                  onClick={() => startLive(captureKind === 'video')}
                  className="px-4 py-2 rounded-full gold-gradient text-white text-xs font-bold"
                >
                  Thử lại camera
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-4 py-2 rounded-full bg-white/15 text-white text-xs font-bold border border-white/20"
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
                <span className="opacity-80">/ {maxVideo}s</span>
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setFlash((f) => !f)}
            className={`absolute top-3 left-3 z-30 w-10 h-10 rounded-full flex items-center justify-center border backdrop-blur-md active:scale-90 transition ${
              isDesktop ? 'bg-white/90 border-slate-200 text-slate-800' : 'bg-black/35 border-white/20 text-white'
            }`}
            title="Flash"
          >
            {flash ? <Zap size={18} className="text-amber-400" /> : <ZapOff size={18} />}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setScreen('history')}
          className={`mt-4 text-sm font-semibold active:scale-95 transition ${isDesktop ? 'text-slate-500 hover:text-slate-800' : 'text-white/80'}`}
        >
          Lịch sử
        </button>

        <div className={`mt-5 w-full max-w-md flex items-center justify-between px-2 ${isDesktop ? 'mt-8' : ''}`}>
          <GlassBtn size="md" variant={btnVariant} label="Lịch sử" onClick={() => setScreen('history')}>
            <Images size={20} />
          </GlassBtn>

          <button
            type="button"
            onClick={onShutter}
            className={`relative w-[5rem] h-[5rem] rounded-full bg-white border-[5px] shadow-[0_8px_32px_rgba(251,191,36,0.45)] active:scale-90 transition flex items-center justify-center ${
              recording ? 'border-rose-500' : 'border-amber-300'
            }`}
            aria-label={captureKind === 'video' ? (recording ? 'Dừng quay' : 'Quay video') : 'Chụp'}
          >
            {captureKind === 'video' ? (
              recording ? (
                <span className="w-7 h-7 rounded-md bg-rose-500" />
              ) : (
                <span className="w-[3.5rem] h-[3.5rem] rounded-full bg-rose-500" />
              )
            ) : (
              <span className="w-[3.5rem] h-[3.5rem] rounded-full border-[3px] border-slate-900/80" />
            )}
          </button>

          <GlassBtn
            size="md"
            variant={btnVariant}
            label="Đổi camera"
            onClick={() => {
              if (recording) return
              setFacing((f) => (f === 'environment' ? 'user' : 'environment'))
            }}
          >
            <SwitchCamera size={20} />
          </GlassBtn>
        </div>

        <p className={`mt-3 text-[11px] text-center px-4 ${isDesktop ? 'text-slate-400' : 'text-white/50'}`}>
          {captureKind === 'photo'
            ? 'Chạm nút tròn để chụp ảnh 1:1'
            : recording
              ? 'Chạm lại để dừng quay'
              : `Chạm nút đỏ để quay (tối đa ${maxVideo}s)`}
        </p>

        {isDesktop && (
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="px-4 py-2 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 active:scale-95 flex items-center gap-1"
            >
              <UploadIcon size={14} /> Upload
            </button>
            <button
              type="button"
              onClick={() => nav('/app/settings')}
              className="px-4 py-2 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 active:scale-95"
            >
              Settings
            </button>
          </div>
        )}
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
        onClose={() => {
          setPostResult(null)
          setScreen('camera')
        }}
        moment={postResult?.moment}
        mediaUrl={postResult?.mediaUrl}
        caption={postResult?.caption}
      />
    </div>
  )
}
