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
    <div className="min-h-dvh sparkle-bg flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] page-enter">
        <Logo size="lg" className="justify-center mb-8" />
        <div className="card-surface p-6 sm:p-8">
          <h1 className="font-display font-extrabold text-2xl">Chào mừng lại</h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">Đăng nhập Locket Dio</p>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email / Username">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="username"
                className="field"
                required
              />
            </Field>
            <Field label="Mật khẩu">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="field"
                required
              />
            </Field>
            <div className="flex justify-end">
              <Link to="/forgot" className="text-xs font-semibold text-indigo-600 hover:underline">
                Quên mật khẩu?
              </Link>
            </div>
            {err && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2">{err}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl dio-gradient text-white font-bold shadow-[var(--shadow-dio)] disabled:opacity-60 press"
            >
              {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            Chưa có tài khoản?{' '}
            <Link to="/signup" className="font-bold text-indigo-600">Đăng ký</Link>
          </p>
        </div>
        <p className="text-center mt-5">
          <Link to="/" className="text-sm text-slate-400 hover:text-indigo-600">← Trang chủ</Link>
        </p>
      </div>
      <style>{`
        .field {
          margin-top: 0.35rem;
          width: 100%;
          border-radius: 0.9rem;
          border: 1px solid #e8ecf4;
          background: #f8fafc;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          outline: none;
        }
        .field:focus { border-color: #6b8aff; box-shadow: 0 0 0 3px rgba(107,138,255,0.2); background: #fff; }
        html.dark .field { background: #1a2336; border-color: #2a3548; color: #fff; }
      `}</style>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
