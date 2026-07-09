import { useBackgroundEffectOptional } from './BackgroundEffectProvider'
import { EFFECT_IDS } from './constants'
import RainEffect from './RainEffect'
import SnowEffect from './SnowEffect'
import SparkleEffect from './SparkleEffect'
import HeartsEffect from './HeartsEffect'
import StarsEffect from './StarsEffect'
import AuroraEffect from './AuroraEffect'
import BubblesEffect from './BubblesEffect'
import FirefliesEffect from './FirefliesEffect'

/**
 * Full-bleed animated background layer.
 * @param {'full'|'subtle'|'camera-desktop'} variant
 */
export default function BackgroundScene({
  variant = 'full',
  forceEffect,
  className = '',
  showGlass = true,
}) {
  const fx = useBackgroundEffectOptional()
  const effectId = forceEffect ?? fx?.effectId ?? EFFECT_IDS.none
  const enabled = forceEffect
    ? forceEffect !== EFFECT_IDS.none
    : !!(fx?.settings?.enabled && effectId !== EFFECT_IDS.none)
  const mobile = fx?.mobile ?? false
  const lowPerf = fx?.lowPerf || variant === 'subtle' || variant === 'camera-desktop'
  const reduceMotion = fx?.reduceMotion ?? false

  if (!enabled || effectId === EFFECT_IDS.none || reduceMotion) {
    return null
  }

  const intensity = effectId === EFFECT_IDS.heavyRain ? 'heavy' : 'soft'
  const opacity =
    variant === 'camera-desktop' ? 'opacity-40' : variant === 'subtle' ? 'opacity-70' : 'opacity-100'

  const common = { mobile, lowPerf: lowPerf || mobile, reduceMotion }

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden z-0 ${opacity} ${className}`}
      aria-hidden
    >
      {/* Soft base wash for dark effects */}
      {(effectId === EFFECT_IDS.softRain || effectId === EFFECT_IDS.heavyRain) && (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/20 via-transparent to-indigo-950/15" />
      )}
      {effectId === EFFECT_IDS.starry && (
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/40 via-violet-950/20 to-transparent" />
      )}
      {effectId === EFFECT_IDS.fireflies && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-emerald-950/10 to-transparent" />
      )}

      {(effectId === EFFECT_IDS.softRain || effectId === EFFECT_IDS.heavyRain) && (
        <RainEffect intensity={intensity} {...common} />
      )}
      {effectId === EFFECT_IDS.snow && <SnowEffect {...common} />}
      {effectId === EFFECT_IDS.sparkles && <SparkleEffect {...common} />}
      {effectId === EFFECT_IDS.hearts && <HeartsEffect {...common} />}
      {effectId === EFFECT_IDS.starry && <StarsEffect {...common} />}
      {effectId === EFFECT_IDS.aurora && <AuroraEffect reduceMotion={reduceMotion} />}
      {effectId === EFFECT_IDS.bubbles && <BubblesEffect {...common} />}
      {effectId === EFFECT_IDS.fireflies && <FirefliesEffect {...common} />}

      {showGlass && variant === 'full' && (
        <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-[0.5px]" />
      )}
    </div>
  )
}
