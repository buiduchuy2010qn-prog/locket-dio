export default function EmptyState({ icon = '✦', title, desc, action }) {
  return (
    <div className="text-center py-14 px-6 page-enter">
      <div className="w-16 h-16 mx-auto rounded-3xl dio-gradient text-white text-2xl flex items-center justify-center shadow-[var(--shadow-dio)] mb-4">
        {icon}
      </div>
      <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">{title}</h3>
      {desc && <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
