import { MessageCircle, Construction } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

/** Chat/messages placeholder — structure ready for real-time DMs later */
export default function Chat() {
  const { user } = useApp()
  return (
    <div className="px-4 max-w-lg mx-auto page-enter py-8 text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <MessageCircle className="text-amber-500" size={28} />
      </div>
      <h1 className="text-2xl font-extrabold">Messages</h1>
      <p className="text-sm text-slate-500 mt-2">
        Direct chat is coming soon. For now, react on moments and use notifications.
      </p>
      <div className="mt-6 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-left text-sm text-slate-500 flex gap-2">
        <Construction size={18} className="shrink-0 text-amber-500" />
        <div>
          <p className="font-semibold text-slate-700 dark:text-slate-200">Placeholder</p>
          <p className="mt-1">Socket.IO rooms + message tables can plug in here without changing camera UI.</p>
          <p className="mt-1 text-xs">Signed in as @{user?.username}</p>
        </div>
      </div>
      <Link to="/app/upload" className="inline-block mt-6 px-5 py-2.5 rounded-xl gold-gradient text-white text-sm font-bold">
        Back to camera
      </Link>
    </div>
  )
}
