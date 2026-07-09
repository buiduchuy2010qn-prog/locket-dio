import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import * as api from '../api/mockApi'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setMsg('')
    setLoading(true)
    try {
      const r = await api.forgotPassword({ email })
      setMsg(r.message)
    } catch (ex) {
      setErr(ex.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen sparkle-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Logo className="justify-center mb-6" />
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-2xl font-extrabold mb-1">Quên mật khẩu</h1>
          <p className="text-sm text-slate-500 mb-6">Nhập email — chúng tôi gửi link đặt lại (mock)</p>
          <form onSubmit={submit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none"
            />
            {err && <p className="text-sm text-red-600">{err}</p>}
            {msg && <p className="text-sm text-emerald-600 bg-emerald-50 rounded-xl p-3">{msg}</p>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl gold-gradient text-white font-bold disabled:opacity-60">
              {loading ? 'Đang gửi…' : 'Gửi link'}
            </button>
          </form>
          <Link to="/login" className="block text-center text-sm font-semibold text-amber-600 mt-4">← Đăng nhập</Link>
        </div>
      </div>
    </div>
  )
}
