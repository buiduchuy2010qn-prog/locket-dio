import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Logo from '../components/Logo'
import * as api from '../api/index.js'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const [state, setState] = useState({ loading: true, ok: false, message: '' })

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setState({ loading: false, ok: false, message: 'Missing token' })
      return
    }
    api
      .verifyEmail({ token })
      .then(() => setState({ loading: false, ok: true, message: 'Email verified! You can log in.' }))
      .catch((e) => setState({ loading: false, ok: false, message: e.message || 'Verification failed' }))
  }, [params])

  return (
    <div className="min-h-screen sparkle-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <Logo className="justify-center mb-6" />
        <div className="bg-white dark:bg-slate-900 rounded-3xl border p-8 shadow-[var(--shadow-card)]">
          <h1 className="text-xl font-extrabold mb-2">Email verification</h1>
          {state.loading ? (
            <p className="text-slate-500 text-sm">Verifying…</p>
          ) : (
            <p className={`text-sm ${state.ok ? 'text-emerald-600' : 'text-red-600'}`}>{state.message}</p>
          )}
          <Link to="/login" className="inline-block mt-6 text-sm font-bold text-amber-600">→ Login</Link>
        </div>
      </div>
    </div>
  )
}
