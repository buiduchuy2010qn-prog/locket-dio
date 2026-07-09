import { Link } from 'react-router-dom'
import { Camera, Users, Sparkles, Square, Shield, ArrowRight } from 'lucide-react'
import Logo from '../components/Logo'
import BackgroundScene from '../effects/BackgroundScene'

export default function Landing() {
  return (
    <div className="min-h-dvh bg-[#0c1222] text-white overflow-x-hidden relative">
      <BackgroundScene variant="full" className="fixed inset-0 z-0" />
      {/* Nav */}
      <header className="relative z-20 max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
        <Logo light />
        <div className="flex items-center gap-2">
          <Link to="/login" className="px-4 py-2 text-sm font-semibold text-white/80 hover:text-white">
            Đăng nhập
          </Link>
          <Link
            to="/signup"
            className="px-5 py-2.5 rounded-full bg-white text-slate-900 text-sm font-bold press shadow-lg"
          >
            Bắt đầu
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 pt-8 pb-20 md:pt-16 md:pb-28 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(900px,120%)] h-[420px] bg-[radial-gradient(ellipse_at_center,rgba(69,99,245,0.35),transparent_65%)] pointer-events-none" />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-semibold text-white/80 mb-6">
            <Sparkles size={12} className="text-indigo-300" />
            App camera riêng · 1:1 · Close friends
          </span>

          <h1 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl tracking-tight leading-[1.08] max-w-3xl mx-auto">
            Chụp moment vuông
            <br />
            <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-rose-300 bg-clip-text text-transparent">
              chỉ với circle của bạn
            </span>
          </h1>

          <p className="mt-5 text-base md:text-lg text-white/55 max-w-lg mx-auto leading-relaxed">
            Locket Dio — web app độc lập. Camera full-screen, feed bạn bè, streak & chat.
            Không liên kết app Locket chính hãng.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full dio-gradient font-bold shadow-[var(--shadow-dio)] press"
            >
              Tạo tài khoản <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              className="px-7 py-3.5 rounded-full bg-white/10 border border-white/15 font-bold press hover:bg-white/15"
            >
              Đã có tài khoản
            </Link>
          </div>

          {/* Phone mock */}
          <div className="mt-16 mx-auto w-[min(280px,82vw)] float-soft">
            <div className="aspect-[9/17] rounded-[2.25rem] border-[5px] border-white/15 bg-gradient-to-b from-[#152038] to-[#0a0f1c] shadow-2xl overflow-hidden relative">
              <div className="absolute top-5 inset-x-5 flex justify-between items-center z-10">
                <span className="w-10 h-10 rounded-full bg-white/15 backdrop-blur" />
                <span className="px-3.5 py-1.5 rounded-full bg-white/12 text-[10px] font-bold backdrop-blur border border-white/10">
                  Tất cả bạn bè
                </span>
                <span className="w-10 h-10 rounded-full bg-white/15 backdrop-blur" />
              </div>
              <div className="absolute inset-x-6 top-[20%] aspect-square rounded-[1.5rem] overflow-hidden ring-2 ring-white/20 shadow-2xl">
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-violet-500 to-rose-400" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera className="text-white/40" size={48} />
                </div>
              </div>
              <div className="absolute bottom-12 inset-x-0 flex justify-center items-center gap-10">
                <span className="w-11 h-11 rounded-full bg-white/10 border border-white/10" />
                <span className="w-[4.25rem] h-[4.25rem] rounded-full border-[4px] border-indigo-300 bg-white shadow-lg" />
                <span className="w-11 h-11 rounded-full bg-white/10 border border-white/10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 bg-[#f4f6fb] text-slate-900 py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="font-display font-extrabold text-2xl md:text-3xl text-center mb-10">
            Đơn giản. Riêng tư. Vuông.
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 md:gap-5">
            {[
              { icon: Camera, t: 'Camera app-like', d: 'Mobile full-screen, PC trắng tối giản, khung 1:1.' },
              { icon: Users, t: 'Close friends only', d: 'Feed & gallery chỉ circle bạn đã kết nối.' },
              { icon: Square, t: 'Mọi media 1:1', d: 'Chụp, crop, feed, gallery — không méo ảnh.' },
              { icon: Sparkles, t: 'Full features free', d: 'Theme, reaction, streak, insights — không paywall.' },
              { icon: Shield, t: 'Tài khoản Dio', d: 'Đăng ký riêng. Không xin mật khẩu app khác.' },
              { icon: MessageCircleIcon, t: 'Chat & react', d: 'Tin nhắn và reaction trên moment bạn bè.' },
            ].map((x) => (
              <div key={x.t} className="p-5 rounded-3xl bg-white border border-slate-100 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] transition">
                <div className="w-11 h-11 rounded-2xl dio-gradient text-white flex items-center justify-center mb-3">
                  <x.icon size={20} />
                </div>
                <h3 className="font-display font-bold text-base">{x.t}</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{x.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 bg-[#0c1222]/90 backdrop-blur text-white/40 text-center text-xs py-8 px-4">
        <p className="font-display font-bold text-white/70 text-sm mb-1">Locket Dio</p>
        <p>Independent product · Original branding · Not affiliated with Locket</p>
      </footer>
    </div>
  )
}

function MessageCircleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={props.size || 20} height={props.size || 20}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}
