import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useApp } from '../context/AppContext'
import BackgroundScene from '../effects/BackgroundScene'

export default function Signup() {
  const { signup } = useApp()
  const nav = useNavigate()
  const [form, setForm] = useState({
    displayName: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (form.password !== form.confirm) {
      setErr('Mật khẩu xác nhận không khớp.')
      return
    }
    if (!/^[a-zA-Z0-9._]{3,20}$/.test(form.username)) {
      setErr('Username 3–20 ký tự: chữ, số, . _')
      return
    }
    setLoading(true)
    try {
      await signup(form)
      nav('/app/upload', { replace: true })
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh sparkle-bg flex items-center justify-center p-4 py-10 relative overflow-hidden">
      <BackgroundScene variant="full" className="fixed inset-0" />
      <div className="w-full max-w-[400px] page-enter relative z-10">
        <Logo className="justify-center mb-6" />
        <div className="card-surface p-6 sm:p-8 backdrop-blur-xl bg-white/90 dark:bg-slate-900/90">
          <h1 className="font-display font-extrabold text-2xl">Tạo tài khoản</h1>
          <p className="text-sm text-slate-500 mt-1 mb-5">Miễn phí · Full tính năng</p>
          <form onSubmit={submit} className="space-y-3">
            {[
              ['displayName', 'Tên hiển thị', 'text', 'Tên của bạn'],
              ['username', 'Username', 'text', 'vd: huy.dio'],
              ['email', 'Email', 'email', 'you@email.com'],
              ['password', 'Mật khẩu', 'password', 'Tối thiểu 6 ký tự'],
              ['confirm', 'Xác nhận', 'password', 'Nhập lại'],
            ].map(([k, label, type, ph]) => (
              <div key={k}>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
                <input
                  type={type}
                  value={form[k]}
                  onChange={set(k)}
                  placeholder={ph}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
                />
              </div>
            ))}
            {err && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2">{err}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl dio-gradient text-white font-bold shadow-[var(--shadow-dio)] disabled:opacity-60 press mt-1"
            >
              {loading ? 'Đang tạo…' : 'Đăng ký & mở camera'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-5">
            Đã có tài khoản? <Link to="/login" className="font-bold text-indigo-600">Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
