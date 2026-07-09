import { useBackgroundEffect } from './BackgroundEffectProvider'
import { EFFECT_IDS, EFFECT_LIST } from './constants'
import BackgroundScene from './BackgroundScene'

export default function EffectSelector({ compact = false }) {
  const { settings, update, setEffect, effectId } = useBackgroundEffect()

  return (
    <div className="space-y-4">
      {/* Toggles */}
      <div className="card-surface p-4 space-y-3">
        <h3 className="font-display font-bold text-sm">Background Effects</h3>
        <Toggle
          label="Bật hiệu ứng nền"
          checked={settings.enabled}
          onChange={(v) => update({ enabled: v })}
        />
        <Toggle
          label="Reduce motion"
          desc="Tắt animation (a11y)"
          checked={settings.reduceMotion}
          onChange={(v) => update({ reduceMotion: v })}
        />
        <Toggle
          label="Low performance mode"
          desc="Ít particle hơn — máy yếu / pin"
          checked={settings.lowPerf}
          onChange={(v) => update({ lowPerf: v })}
        />
      </div>

      {/* Grid */}
      <div className={`grid gap-2.5 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {EFFECT_LIST.map((item) => {
          const active = effectId === item.id || (!settings.enabled && item.id === EFFECT_IDS.none)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === EFFECT_IDS.none) {
                  update({ enabled: false, effectId: EFFECT_IDS.none })
                } else {
                  update({ enabled: true, effectId: item.id, reduceMotion: false })
                  setEffect(item.id)
                }
              }}
              className={`relative overflow-hidden rounded-2xl border text-left press transition ${
                active
                  ? 'border-indigo-500 ring-2 ring-indigo-300/60 shadow-[var(--shadow-dio)]'
                  : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200'
              }`}
            >
              <div className={`relative h-20 bg-gradient-to-br ${item.preview}`}>
                {item.id !== EFFECT_IDS.none && settings.enabled && (
                  <BackgroundScene
                    forceEffect={item.id}
                    variant="subtle"
                    showGlass={false}
                    className="!opacity-90"
                  />
                )}
                <span className="absolute top-2 left-2 text-lg drop-shadow">{item.emoji}</span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900">
                <p className="text-xs font-bold truncate">{item.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Toggle({ label, desc, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        {desc && <p className="text-[11px] text-slate-400">{desc}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition shrink-0 ${
          checked ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </label>
  )
}

/** Minimal toggle for settings row */
export function ReducedMotionToggle() {
  const { settings, update } = useBackgroundEffect()
  return (
    <label className="flex items-center gap-3 px-4 py-3 border-t border-slate-50 dark:border-slate-800 cursor-pointer">
      <span className="flex-1 text-sm font-medium">Reduce motion</span>
      <input
        type="checkbox"
        checked={!!settings.reduceMotion}
        onChange={(e) => update({ reduceMotion: e.target.checked })}
        className="w-4 h-4 accent-indigo-500"
      />
    </label>
  )
}
