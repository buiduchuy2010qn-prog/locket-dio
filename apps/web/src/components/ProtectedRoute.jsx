import { Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function ProtectedRoute({ children }) {
  const { user, booting } = useApp()
  const loc = useLocation()

  if (booting) {
    return (
      <div className="min-h-dvh flex items-center justify-center sparkle-bg">
        <div className="text-center page-enter">
          <div className="w-14 h-14 mx-auto rounded-2xl dio-gradient shadow-[var(--shadow-dio)] animate-pulse mb-3" />
          <p className="text-sm text-slate-500 font-semibold">Locket Dio</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return children
}
