import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { useApp } from '../context/AppContext'

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
      nav('/app/feed', { replace: true })
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen sparkle-bg flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        <Logo className="justify-center mb-6" />
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-[var(--shadow-card)] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 page-enter">
          <h1 className="text-2xl font-extrabold mb-1">Tạo tài khoản</h1>
          <p className="text-sm text-slate-500 mb-6">Miễn phí · Avatar tự sinh · Setup username</p>
          <form onSubmit={submit} className="space-y-3">
            {[
              ['displayName', 'Tên hiển thị', 'text', 'Tên của bạn'],
              ['username', 'Username', 'text', 'vd: mina.rose'],
              ['email', 'Email', 'email', 'you@email.com'],
              ['password', 'Mật khẩu', 'password', 'Tối thiểu 6 ký tự'],
              ['confirm', 'Xác nhận mật khẩu', 'password', 'Nhập lại'],
            ].map(([k, label, type, ph]) => (
              <div key={k}>
                <label className="text-xs font-bold text-slate-500 uppercase">{label}</label>
                <input
                  type={type}
                  value={form[k]}
                  onChange={set(k)}
                  placeholder={ph}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            ))}
            {err && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{err}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl gold-gradient text-white font-bold shadow-[var(--shadow-gold)] disabled:opacity-60"
            >
              {loading ? 'Đang tạo…' : 'Đăng ký'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-5">
            Đã có tài khoản? <Link to="/login" className="font-bold text-amber-600">Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
