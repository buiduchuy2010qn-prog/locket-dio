import { Link } from 'react-router-dom'
import { Camera, Users, Flame, Sparkles, Shield, Zap, Star } from 'lucide-react'
import Logo from '../components/Logo'
import { GOLD_FEATURES } from '../data/constants'

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-40 glass border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300">
              Đăng nhập
            </Link>
            <Link to="/signup" className="px-4 py-2.5 rounded-xl gold-gradient text-white text-sm font-bold shadow-[var(--shadow-gold)]">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="sparkle-bg border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
          <div className="page-enter">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold mb-4">
              <Sparkles size={12} /> Private · Close friends · Premium
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Chia sẻ khoảnh khắc{' '}
              <span className="gold-text">chỉ với bạn thân</span>
            </h1>
            <p className="mt-5 text-lg text-slate-500 dark:text-slate-400 max-w-lg">
              Piclet Gold là mạng xã hội ảnh riêng tư — nhanh, ấm áp, tinh tế. Đăng moment, giữ streak, và nâng tầm trải nghiệm với Gold.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className="px-6 py-3.5 rounded-2xl gold-gradient text-white font-bold shadow-[var(--shadow-gold)]">
                Get Started — miễn phí
              </Link>
              <Link to="/signup" className="px-6 py-3.5 rounded-2xl border-2 border-amber-300 text-amber-800 dark:text-amber-300 font-bold bg-amber-50/50 dark:bg-amber-500/10">
                Upgrade to Gold
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1"><Star size={14} className="text-amber-400" /> 4.9 rating</span>
              <span>·</span>
              <span>10k+ moments / ngày (demo)</span>
            </div>
          </div>

          {/* Mockup */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -inset-6 bg-gradient-to-br from-amber-300/40 to-rose-300/30 blur-3xl rounded-full" />
            <div className="relative rounded-[2.5rem] border-8 border-slate-900 dark:border-slate-700 bg-slate-900 shadow-2xl overflow-hidden aspect-[9/16]">
              <div className="absolute inset-0 bg-gradient-to-b from-rose-200 via-amber-100 to-orange-200">
                <img
                  src="https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=80&auto=format&fit=crop"
                  alt="Preview"
                  className="w-full h-full object-cover opacity-90"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/70 to-transparent text-white">
                <p className="font-bold">Mina · 1 giờ trước</p>
                <p className="text-sm opacity-90">Golden hour ✨</p>
                <div className="mt-3 flex gap-2">
                  <span className="px-3 py-1 rounded-full bg-white/20 text-sm backdrop-blur">❤️ 12</span>
                  <span className="px-3 py-1 rounded-full bg-white/20 text-sm backdrop-blur">🔥 4</span>
                </div>
              </div>
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                <span className="text-white font-extrabold text-sm drop-shadow">Piclet</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950">GOLD</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-extrabold text-center mb-3">Đơn giản. Riêng tư. Cảm xúc.</h2>
        <p className="text-center text-slate-500 mb-10 max-w-xl mx-auto">Mọi thứ bạn cần để giữ kết nối với circle nhỏ — không ồn ào feed công khai.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Camera, title: 'Moment tức thì', desc: 'Chụp hoặc tải ảnh/video, caption ngắn, đăng cho friends only.' },
            { icon: Users, title: 'Circle bạn thân', desc: 'Thêm bạn theo username, close friends, chặn khi cần.' },
            { icon: Flame, title: 'Streak ấm áp', desc: 'Giữ chuỗi ngày đăng với từng người — đừng để lửa tắt.' },
            { icon: Shield, title: 'Riêng tư mặc định', desc: 'Mọi moment chỉ hiển thị với bạn bè đã kết nối.' },
            { icon: Zap, title: 'Nhanh trên mọi thiết bị', desc: 'Desktop dashboard + mobile app-like, tablet adaptive.' },
            { icon: Sparkles, title: 'Piclet Gold', desc: 'Theme, badge, video dài, unlimited friends, insights…' },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-3xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 hover:shadow-[var(--shadow-card)] transition">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center mb-4">
                <f.icon size={20} />
              </div>
              <h3 className="font-bold text-lg">{f.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gold section */}
      <section className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-400 text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold">Piclet Gold</h2>
            <p className="mt-2 text-white/90 max-w-lg mx-auto">Trải nghiệm premium — không quảng cáo, không giới hạn, toàn bộ theme & insights.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GOLD_FEATURES.slice(0, 6).map((g) => (
              <div key={g.id} className="p-4 rounded-2xl bg-white/15 backdrop-blur border border-white/20">
                <p className="font-bold">{g.title}</p>
                <p className="text-sm text-white/85 mt-1">{g.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/signup" className="inline-flex px-8 py-3.5 rounded-2xl bg-white text-amber-800 font-extrabold shadow-lg">
              Upgrade to Gold
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-extrabold text-center mb-10">Mọi người nói gì</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { name: 'An', q: 'Như nhật ký chung với besties. UI siêu mượt trên điện thoại.' },
            { name: 'Bảo', q: 'Gold themes đẹp, streak restore cứu team mình không mất chuỗi 30 ngày.' },
            { name: 'Chi', q: 'Thích cảm giác private — không algorithm ồn ào.' },
          ].map((t) => (
            <blockquote key={t.name} className="p-6 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[var(--shadow-soft)]">
              <p className="text-slate-600 dark:text-slate-300">“{t.q}”</p>
              <footer className="mt-4 font-bold text-sm">— {t.name}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-100 dark:border-slate-800 py-10 text-center text-sm text-slate-400">
        <Logo className="justify-center mb-3" />
        <p>© 2026 Piclet Gold · Original branding · Not affiliated with any third-party lock-screen apps</p>
        <div className="mt-3 flex justify-center gap-4">
          <Link to="/login" className="hover:text-amber-600">Đăng nhập</Link>
          <Link to="/signup" className="hover:text-amber-600">Đăng ký</Link>
        </div>
      </footer>
    </div>
  )
}
