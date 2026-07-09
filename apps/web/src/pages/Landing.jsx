import { Link } from 'react-router-dom'
import { Camera, Download, Smartphone, Sparkles, Square, Share2 } from 'lucide-react'
import Logo from '../components/Logo'

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 text-sm font-semibold text-slate-600">Đăng nhập</Link>
            <Link to="/signup" className="px-4 py-2.5 rounded-full gold-gradient text-white text-sm font-bold shadow-[var(--shadow-gold)]">
              Bắt đầu
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — locket-dio.com style messaging */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1526] via-[#12253f] to-[#0a1020]" />
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.25),_transparent_55%)]" />
        <div className="relative max-w-5xl mx-auto px-4 py-16 md:py-24 text-center text-white">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-bold mb-5">
            <Sparkles size={12} className="text-amber-300" /> Web camera · 1:1 · Close friends
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Chụp & đăng moment vuông
            <br />
            <span className="text-amber-300">dễ hơn bao giờ hết</span>
          </h1>
          <p className="mt-4 text-white/70 max-w-xl mx-auto text-base md:text-lg">
            Locket Dio — web camera riêng tư. Chụp 1:1 trên trình duyệt, lưu circle bạn bè,
            rồi tải / share sang điện thoại để đăng trên app Locket <strong className="text-white/90">thủ công</strong>.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="px-7 py-3.5 rounded-full gold-gradient text-white font-bold shadow-lg active:scale-95">
              Mở camera web
            </Link>
            <Link to="/login" className="px-7 py-3.5 rounded-full bg-white/10 border border-white/20 font-bold backdrop-blur active:scale-95">
              Đăng nhập
            </Link>
          </div>
          <p className="mt-4 text-[11px] text-white/45 max-w-md mx-auto">
            Không yêu cầu mật khẩu Locket chính hãng · Không auto-sync trái phép · Original branding
          </p>

          {/* Phone mock */}
          <div className="mt-14 mx-auto w-[min(280px,85vw)] aspect-[9/16] rounded-[2rem] border-[6px] border-white/20 bg-black/40 shadow-2xl overflow-hidden relative">
            <div className="absolute top-4 inset-x-4 flex justify-between items-center z-10">
              <span className="w-9 h-9 rounded-full bg-white/20 backdrop-blur" />
              <span className="px-3 py-1.5 rounded-full bg-white/15 text-[10px] font-bold backdrop-blur">Tất cả bạn bè</span>
              <span className="w-9 h-9 rounded-full bg-white/20 backdrop-blur" />
            </div>
            <div className="absolute inset-x-6 top-[22%] aspect-square rounded-3xl overflow-hidden ring-2 ring-white/30 shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&q=80&auto=format&fit=crop"
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-10 inset-x-0 flex justify-center items-center gap-8">
              <span className="w-10 h-10 rounded-full bg-white/15" />
              <span className="w-16 h-16 rounded-full border-4 border-amber-300 bg-white shadow-lg" />
              <span className="w-10 h-10 rounded-full bg-white/15" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works 1+2 */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-extrabold text-center mb-10">Cách dùng</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Camera, t: '1. Chụp trên web', d: 'Camera full-screen kiểu app, khung vuông 1:1, crop & caption.' },
            { icon: Square, t: '2. Lưu trên Dio', d: 'Moment nằm trong circle bạn bè Locket Dio — app riêng của bạn.' },
            { icon: Smartphone, t: '3. Đăng Locket (tay)', d: 'Tải / Share / QR sang điện thoại → mở app Locket → đăng.' },
          ].map((x) => (
            <div key={x.t} className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 hover:shadow-md transition">
              <div className="w-11 h-11 rounded-2xl gold-gradient text-white flex items-center justify-center mb-4">
                <x.icon size={20} />
              </div>
              <h3 className="font-bold text-lg">{x.t}</h3>
              <p className="text-sm text-slate-500 mt-1">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 border-y border-slate-100 py-14">
        <div className="max-w-5xl mx-auto px-4 grid sm:grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { icon: Download, t: 'Tải 1:1' },
            { icon: Share2, t: 'Share sheet' },
            { icon: Smartphone, t: 'QR điện thoại' },
            { icon: Sparkles, t: 'Caption + crop' },
          ].map((x) => (
            <div key={x.t} className="p-4 rounded-2xl bg-white border border-slate-100">
              <x.icon className="mx-auto text-amber-500 mb-2" size={22} />
              <p className="text-sm font-bold">{x.t}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="py-10 text-center text-xs text-slate-400">
        <Logo className="justify-center mb-3" />
        <p>© Locket Dio · Original branding · Not affiliated with Locket Inc.</p>
        <p className="mt-1">Không yêu cầu mật khẩu app Locket chính hãng.</p>
      </footer>
    </div>
  )
}
