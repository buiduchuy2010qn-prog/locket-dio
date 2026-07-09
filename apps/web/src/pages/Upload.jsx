import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, MessageCircle, Grid3X3, Camera, SwitchCamera, Zap, ZapOff,
  Images, MoreHorizontal, Heart, Flame, Send, X, Upload as UploadIcon, Bell, Crown,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import * as api from '../api/index.js'
import { FREE_VIDEO_MAX_SEC, GOLD_VIDEO_MAX_SEC } from '../data/constants'
import SquareFrame from '../components/SquareFrame'
import SquareCropEditor from '../components/SquareCropEditor'
import { exportSquareCrop } from '../utils/squareCrop'
import GlassBtn, { FriendsPill } from '../components/camera/GlassBtn'
import PostSuccessModal from '../components/camera/PostSuccessModal'
import Avatar from '../components/Avatar'
import { timeAgo } from '../utils/storage'

/**
 * Locket-style camera experience:
 * Mobile = immersive dark/blue full-screen
 * Desktop = white minimal centered square + floating controls
 */
export default function Upload() {
  const { user, toast, openUpgrade, unreadCount } = useApp()
  const nav = useNavigate()

  const [screen, setScreen] = useState('camera') // camera | history | detail | compose
  const [mode, setMode] = useState('camera') // camera | gallery (toggle pill)
  const [facing, setFacing] = useState('environment')
  const [flash, setFlash] = useState(false)
  const [friendsLabel, setFriendsLabel] = useState('Tất cả bạn bè')
  const [friendCount, setFriendCount] = useState(0)

  const [sourceUrl, setSourceUrl] = useState(null)
  const [type, setType] = useState('image')
  const [caption, setCaption] = useState('')
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(false)
  const [crop, setCrop] = useState({ zoom: 1, offsetX: 0, offsetY: 0 })
  const [posts, setPosts] = useState([])
  const [selected, setSelected] = useState(null)
  const [msg, setMsg] = useState('')
  const [audience, setAudience] = useState('FRIENDS') // FRIENDS | CLOSE_FRIENDS
  const [syncOfficial, setSyncOfficial] = useState(false)
  const [postResult, setPostResult] = useState(null) // { moment, mediaUrl, caption, sync }
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)

  const liveRef = useRef(null)
  const streamRef = useRef(null)
  const fileRef = useRef(null)
  const maxVideo = user?.isGold ? GOLD_VIDEO_MAX_SEC : FREE_VIDEO_MAX_SEC

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const fn = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  useEffect(() => {
    api.fetchFriends().then((f) => {
      setFriendCount(f.length)
      setFriendsLabel(f.length ? `Tất cả bạn bè · ${f.length}` : 'Tất cả bạn bè')
    }).catch(() => {})
  }, [])

  const loadHistory = useCallback(() => {
    api.fetchGallery('all').then(setPosts).catch(() => setPosts([]))
  }, [])

  useEffect(() => {
    if (screen === 'history') loadHistory()
  }, [screen, loadHistory])

  const stopLive = useCallback(() => {
    streamRef.current?.getTracks()?.forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => stopLive(), [stopLive])

  const startLive = useCallback(async () => {
    try {
      stopLive()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, aspectRatio: { ideal: 1 }, width: { ideal: 1280 } },
        audio: false,
      })
      streamRef.current = stream
      if (liveRef.current) {
        liveRef.current.srcObject = stream
        await liveRef.current.play().catch(() => {})
      }
    } catch {
      toast('Không mở được camera — dùng thư viện', 'error')
    }
  }, [facing, stopLive, toast])

  useEffect(() => {
    if (screen === 'camera' && mode === 'camera' && !sourceUrl) {
      startLive()
    } else if (sourceUrl || screen !== 'camera') {
      stopLive()
    }
  }, [screen, mode, facing, sourceUrl, startLive, stopLive])

  const capture = () => {
    const video = liveRef.current
    if (!video?.videoWidth) return toast('Camera chưa sẵn sàng', 'error')
    const side = Math.min(video.videoWidth, video.videoHeight)
    const sx = (video.videoWidth - side) / 2
    const sy = (video.videoHeight - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = 1080
    canvas.height = 1080
    canvas.getContext('2d').drawImage(video, sx, sy, side, side, 0, 0, 1080, 1080)
    stopLive()
    setSourceUrl(canvas.toDataURL('image/jpeg', 0.92))
    setType('image')
    setCrop({ zoom: 1, offsetX: 0, offsetY: 0 })
    setScreen('compose')
  }

  const readFile = (file, mediaType) => {
    if (!file) return
    stopLive()
    if (mediaType === 'video') {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      v.onloadedmetadata = () => {
        setDuration(Math.round(v.duration || 0))
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
        setScreen('compose')
      }
      r.readAsDataURL(file)
    }
  }

  const onCropChange = useCallback((c) => setCrop(c), [])

  const post = async () => {
    if (!sourceUrl) return
    if (type === 'video' && duration > maxVideo) {
      return openUpgrade('Longer videos', `Video tối đa ${maxVideo}s`)
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
        syncOfficial,
      })
      toast('Đã lưu trên Locket Dio (1:1)')
      setPostResult({
        moment: result,
        mediaUrl,
        caption,
        sync: result.officialSync || null,
      })
      setSourceUrl(null)
      setCaption('')
      loadHistory()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const btnVariant = isDesktop ? 'light' : 'dark'

  /* ─── shared top chrome ─── */
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
        <GlassBtn size="md" variant={dark ? 'dark' : 'light'} label="Chat" onClick={() => nav('/app/notifications')}>
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

  /* ════════════════ HISTORY (mobile-first dark) ════════════════ */
  if (screen === 'history') {
    return (
      <div className={`fixed inset-0 z-30 lg:relative lg:inset-auto lg:min-h-[80vh] ${isDesktop ? 'bg-white' : 'bg-black'} page-enter`}>
        <div className={`relative min-h-full ${isDesktop ? 'max-w-2xl mx-auto' : ''}`}>
          <TopChrome dark={!isDesktop} />
          <div className="pt-20 px-3 pb-28">
            <h1 className={`text-center font-bold mb-4 ${isDesktop ? 'text-slate-800' : 'text-white'}`}>Lịch sử</h1>
            {posts.length === 0 ? (
              <p className={`text-center text-sm py-16 ${isDesktop ? 'text-slate-400' : 'text-white/50'}`}>Chưa có moment</p>
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
          {/* floating capture */}
          <div className="fixed bottom-8 inset-x-0 z-40 flex justify-center lg:bottom-10">
            <GlassBtn
              size="xl"
              variant="solid"
              label="Chụp"
              className="!bg-white border-4 border-slate-200 shadow-2xl"
              onClick={() => { setSourceUrl(null); setScreen('camera'); setMode('camera') }}
            >
              <span className="w-14 h-14 rounded-full border-[3px] border-slate-800" />
            </GlassBtn>
          </div>
        </div>
      </div>
    )
  }

  /* ════════════════ DETAIL ════════════════ */
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
            {['❤️', '😍', '🔥'].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => api.reactToMoment(selected.id, e).then(() => toast(`React ${e}`)).catch((err) => toast(err.message, 'error'))}
                className="w-11 h-11 rounded-full bg-white/10 border border-white/15 text-lg active:scale-90 transition backdrop-blur-md"
              >
                {e}
              </button>
            ))}
            <button type="button" className="w-11 h-11 rounded-full bg-white/10 border border-white/15 text-white active:scale-90 backdrop-blur-md">
              😊
            </button>
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
              onClick={() => { if (msg.trim()) { toast('Đã gửi (mock)'); setMsg('') } }}
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
          <GlassBtn size="md" variant={btnVariant} label="Thêm" onClick={() => toast('Tuỳ chọn', 'info')}>
            <MoreHorizontal size={20} />
          </GlassBtn>
        </div>
      </div>
    )
  }

  /* ════════════════ COMPOSE (crop + audience + post) ════════════════ */
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
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            placeholder="Thêm caption..."
            className={`mt-3 w-full rounded-2xl px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-amber-400 ${
              isDesktop ? 'bg-slate-50 border border-slate-200' : 'bg-white/10 border border-white/15 text-white placeholder:text-white/40 backdrop-blur-md'
            }`}
          />
          {/* Audience */}
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
          <label className={`mt-3 flex items-start gap-2 text-xs ${isDesktop ? 'text-slate-600' : 'text-white/70'}`}>
            <input
              type="checkbox"
              checked={syncOfficial}
              onChange={(e) => setSyncOfficial(e.target.checked)}
              className="mt-0.5 accent-amber-500"
            />
            <span>
              Also try <strong>Official Locket Sync</strong> (OAuth/API only — never password). If unavailable, you will get export options.
            </span>
          </label>
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
              className="flex-1 py-3 rounded-2xl gold-gradient text-white font-bold text-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Đang đăng…' : 'Đăng 1:1'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ════════════════ CAMERA (main) ════════════════ */
  const cameraShell = isDesktop
    ? 'min-h-[calc(100vh-2rem)] bg-white relative flex flex-col'
    : 'fixed inset-0 z-30 bg-gradient-to-b from-[#0b1526] via-[#0e1c33] to-black flex flex-col'

  return (
    <div className={`${cameraShell} page-enter`}>
      <TopChrome dark={!isDesktop} />

      {/* optional desktop extras */}
      {isDesktop && (
        <div className="absolute top-4 right-20 z-40 flex gap-2">
          <GlassBtn size="sm" variant="light" label="Gold" onClick={() => nav('/app/gold')}><Crown size={16} className="text-amber-500" /></GlassBtn>
          <GlassBtn size="sm" variant="light" label="TB" onClick={() => nav('/app/notifications')}><Bell size={16} /></GlassBtn>
        </div>
      )}

      <div className={`flex-1 flex flex-col items-center justify-center px-4 ${isDesktop ? 'pt-8 pb-8' : 'pt-16 pb-4'}`}>
        {/* mode pill over preview */}
        <div className="mb-3 z-20">
          <div className={`inline-flex p-1 rounded-full border backdrop-blur-md ${isDesktop ? 'bg-slate-100 border-slate-200' : 'bg-white/10 border-white/20'}`}>
            {['camera', 'gallery'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  if (m === 'gallery') {
                    if (!user?.isGold) return openUpgrade('Camera roll', 'Thư viện dành cho Gold')
                    fileRef.current?.click()
                    setMode('camera')
                  }
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition active:scale-95 ${
                  mode === m
                    ? isDesktop ? 'bg-white shadow text-slate-900' : 'bg-white text-slate-900'
                    : isDesktop ? 'text-slate-500' : 'text-white/70'
                }`}
              >
                {m === 'camera' ? 'Camera' : 'Thư viện'}
              </button>
            ))}
          </div>
        </div>

        {/* SQUARE FRAME */}
        <div className={`relative w-full ${isDesktop ? 'max-w-[420px]' : 'max-w-[min(100%,420px)]'}`}>
          <SquareFrame showSafeGuide className="!rounded-[1.75rem] sm:!rounded-[2rem]">
            <video
              ref={liveRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          </SquareFrame>

          {/* flash */}
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

        {/* Lịch sử link */}
        <button
          type="button"
          onClick={() => setScreen('history')}
          className={`mt-4 text-sm font-semibold active:scale-95 transition ${isDesktop ? 'text-slate-500 hover:text-slate-800' : 'text-white/80'}`}
        >
          Lịch sử
        </button>

        {/* Bottom controls row */}
        <div className={`mt-5 w-full max-w-md flex items-center justify-between px-2 ${isDesktop ? 'mt-8' : ''}`}>
          <GlassBtn
            size="md"
            variant={btnVariant}
            label="Lịch sử"
            onClick={() => setScreen('history')}
          >
            <Images size={20} />
          </GlassBtn>

          {/* Capture — large circle */}
          <button
            type="button"
            onClick={capture}
            className="relative w-[4.75rem] h-[4.75rem] rounded-full bg-white border-[5px] border-slate-300 shadow-2xl active:scale-90 transition flex items-center justify-center"
            aria-label="Chụp"
          >
            <span className="w-[3.4rem] h-[3.4rem] rounded-full border-2 border-slate-800/80" />
          </button>

          <GlassBtn
            size="md"
            variant={btnVariant}
            label="Đổi camera"
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          >
            <SwitchCamera size={20} />
          </GlassBtn>
        </div>

        {isDesktop && (
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (!user?.isGold) return openUpgrade('Camera roll', 'Thư viện Gold')
                fileRef.current?.click()
              }}
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
        }}
      />

      <PostSuccessModal
        open={!!postResult}
        onClose={() => {
          setPostResult(null)
          setScreen('history')
        }}
        moment={postResult?.moment}
        mediaUrl={postResult?.mediaUrl}
        caption={postResult?.caption}
        syncResult={postResult?.sync}
      />
    </div>
  )
}
