import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Logo from '../components/Logo'
import { useApp } from '../context/AppContext'

export default function Login() {
  const { login } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      await login({ email, password })
      nav(loc.state?.from || '/app/upload', { replace: true })
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen sparkle-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Logo size="lg" className="justify-center" />
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-[var(--shadow-card)] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 page-enter">
          <h1 className="text-2xl font-extrabold mb-1">Đăng nhập</h1>
          <p className="text-sm text-slate-500 mb-6">Chào mừng trở lại Locket Dio</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Email / Username</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                autoComplete="username"
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                required
              />
            </div>
            <div className="flex justify-end">
              <Link to="/forgot" className="text-xs font-semibold text-amber-600 hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
            {err && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{err}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl gold-gradient text-white font-bold shadow-[var(--shadow-gold)] disabled:opacity-60"
            >
              {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-5">
            Chưa có tài khoản?{' '}
            <Link to="/signup" className="font-bold text-amber-600">Đăng ký</Link>
          </p>
        </div>
        <p className="text-center mt-4">
          <Link to="/" className="text-sm text-slate-400 hover:text-amber-600">← Về trang chủ</Link>
        </p>
      </div>
    </div>
  )
}
