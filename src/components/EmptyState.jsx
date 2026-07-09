export default function EmptyState({ icon, title, desc, action }) {
  return (
    <div className="text-center py-14 px-6">
      <div className="text-4xl mb-3 opacity-80">{icon || '📭'}</div>
      <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      {desc && <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
