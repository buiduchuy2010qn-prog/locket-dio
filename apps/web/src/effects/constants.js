/** Background effect catalog for Locket Dio */

export const EFFECT_IDS = {
  none: 'none',
  softRain: 'soft-rain',
  heavyRain: 'heavy-rain',
  starry: 'starry-night',
  hearts: 'floating-hearts',
  sparkles: 'gold-sparkles',
  snow: 'snow-fall',
  aurora: 'aurora-gradient',
  bubbles: 'dream-bubbles',
  fireflies: 'fireflies',
}

export const EFFECT_LIST = [
  { id: EFFECT_IDS.none, name: 'None', emoji: '○', desc: 'Không hiệu ứng', preview: 'from-slate-100 to-slate-200' },
  { id: EFFECT_IDS.softRain, name: 'Soft Rain', emoji: '🌧', desc: 'Mưa nhẹ, calm', preview: 'from-slate-700 via-indigo-900 to-slate-900' },
  { id: EFFECT_IDS.heavyRain, name: 'Heavy Rain', emoji: '⛈', desc: 'Mưa dày cinematic', preview: 'from-slate-900 via-blue-950 to-black' },
  { id: EFFECT_IDS.starry, name: 'Starry Night', emoji: '✨', desc: 'Sao đêm lấp lánh', preview: 'from-indigo-950 via-violet-950 to-black' },
  { id: EFFECT_IDS.hearts, name: 'Floating Hearts', emoji: '💕', desc: 'Trái tim bay nhẹ', preview: 'from-rose-100 via-pink-200 to-rose-300' },
  { id: EFFECT_IDS.sparkles, name: 'Gold Sparkles', emoji: '✦', desc: 'Lấp lánh premium', preview: 'from-amber-900 via-yellow-800 to-stone-900' },
  { id: EFFECT_IDS.snow, name: 'Snow Fall', emoji: '❄', desc: 'Tuyết rơi êm', preview: 'from-sky-100 via-slate-200 to-blue-100' },
  { id: EFFECT_IDS.aurora, name: 'Aurora Gradient', emoji: '🌌', desc: 'Cực quang gradient', preview: 'from-emerald-900 via-violet-900 to-indigo-950' },
  { id: EFFECT_IDS.bubbles, name: 'Dream Bubbles', emoji: '🫧', desc: 'Bong bóng mơ màng', preview: 'from-cyan-100 via-sky-200 to-indigo-200' },
  { id: EFFECT_IDS.fireflies, name: 'Fireflies', emoji: '🔆', desc: 'Đom đóm lung linh', preview: 'from-stone-900 via-emerald-950 to-black' },
]

export const FX_STORAGE_KEY = 'locket_dio_bg_fx_v1'

export const DEFAULT_FX_SETTINGS = {
  enabled: true,
  effectId: EFFECT_IDS.softRain,
  reduceMotion: false,
  lowPerf: false,
}
