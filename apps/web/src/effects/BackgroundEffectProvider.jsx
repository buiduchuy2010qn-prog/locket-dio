import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react'
import { DEFAULT_FX_SETTINGS, EFFECT_IDS, EFFECT_LIST, FX_STORAGE_KEY } from './constants'

const FxContext = createContext(null)

function loadSettings() {
  try {
    const raw = localStorage.getItem(FX_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_FX_SETTINGS }
    return { ...DEFAULT_FX_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_FX_SETTINGS }
  }
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function isMobileWidth() {
  try {
    return window.matchMedia('(max-width: 768px)').matches
  } catch {
    return false
  }
}

export function BackgroundEffectProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const s = loadSettings()
    if (prefersReducedMotion()) s.reduceMotion = true
    return s
  })
  const [mobile, setMobile] = useState(() => (typeof window !== 'undefined' ? isMobileWidth() : false))

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMq = () => setMobile(mq.matches)
    const onRm = () => {
      if (rm.matches) setSettings((s) => ({ ...s, reduceMotion: true }))
    }
    mq.addEventListener('change', onMq)
    rm.addEventListener('change', onRm)
    return () => {
      mq.removeEventListener('change', onMq)
      rm.removeEventListener('change', onRm)
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(settings))
    } catch { /* ignore */ }
  }, [settings])

  const update = useCallback((patch) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  const setEffect = useCallback((effectId) => {
    setSettings((s) => ({ ...s, effectId, enabled: effectId !== EFFECT_IDS.none ? true : s.enabled }))
  }, [])

  const value = useMemo(() => ({
    settings,
    update,
    setEffect,
    effectId: settings.enabled ? settings.effectId : EFFECT_IDS.none,
    mobile,
    lowPerf: settings.lowPerf,
    reduceMotion: settings.reduceMotion || prefersReducedMotion(),
    enabled: settings.enabled && !settings.reduceMotion,
    catalog: EFFECT_LIST,
  }), [settings, update, setEffect, mobile])

  return <FxContext.Provider value={value}>{children}</FxContext.Provider>
}

export function useBackgroundEffect() {
  const ctx = useContext(FxContext)
  if (!ctx) throw new Error('useBackgroundEffect within BackgroundEffectProvider')
  return ctx
}

/** Safe hook when provider might wrap only part of tree */
export function useBackgroundEffectOptional() {
  return useContext(FxContext)
}
