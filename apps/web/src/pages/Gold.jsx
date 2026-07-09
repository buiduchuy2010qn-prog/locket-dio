import { Link } from 'react-router-dom'
import { Check, Sparkles } from 'lucide-react'

/** Paywall removed — all features free */
export default function Gold() {
  return (
    <div className="px-4 md:px-0 max-w-lg mx-auto py-8 space-y-6">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl gold-gradient text-white flex items-center justify-center shadow-lg mb-3">
          <Sparkles size={28} />
        </div>
        <h1 className="text-2xl font-extrabold">Full tính năng</h1>
        <p className="text-sm text-slate-500 mt-2">
          Không cần nâng cấp Gold. Mọi tài khoản đều dùng được chụp ảnh, quay video, thư viện, bạn bè và tuỳ chỉnh.
        </p>
      </div>

      <ul className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 space-y-3">
        {[
          'Chụp ảnh 1:1 & quay video',
          'Tải từ thư viện ảnh/video',
          'Bạn bè không giới hạn',
          'Reaction đầy đủ & Insights',
          'Theme camera & profile',
          'Không quảng cáo',
        ].map((t) => (
          <li key={t} className="flex items-center gap-2 text-sm font-medium">
            <Check size={16} className="text-emerald-500 shrink-0" /> {t}
          </li>
        ))}
      </ul>

      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          to="/app/upload"
          className="flex-1 py-3.5 rounded-2xl gold-gradient text-white font-bold text-center text-sm"
        >
          Mở camera
        </Link>
        <Link
          to="/app/gold/customize"
          className="flex-1 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-center text-sm"
        >
          Tuỳ chỉnh theme
        </Link>
      </div>
    </div>
  )
}
