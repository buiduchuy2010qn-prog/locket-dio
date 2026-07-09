import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'
import * as api from '../api/index.js'
import Modal from '../components/Modal'
import { FREE_VS_GOLD, GOLD_DROPS, GOLD_FEATURES, PLANS } from '../data/constants'

export default function Gold() {
  const { user, activateGold, refreshUser, toast } = useApp()
  const [period, setPeriod] = useState('yearly')
  const [checkout, setCheckout] = useState(false)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const plan = PLANS[period]

  const pay = async () => {
    setLoading(true)
    try {
      await activateGold(period)
      setCheckout(false)
      setSuccess(true)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const cancel = async () => {
    if (!confirm('Hủy gói Gold? Bạn sẽ mất quyền premium.')) return
    await api.cancelGoldSubscription()
    await refreshUser()
    toast('Đã hủy Gold (mock)')
  }

  const restore = async () => {
    setLoading(true)
    try {
      await api.restoreGoldPurchase()
      await refreshUser()
      toast('Đã khôi phục mua hàng Gold')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 md:px-0 max-w-3xl mx-auto space-y-6 pb-8">
      <div className="rounded-3xl gold-gradient p-6 md:p-8 text-white shadow-[var(--shadow-gold)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
        <p className="text-sm font-semibold opacity-90 flex items-center gap-1"><Sparkles size={14} /> Piclet Gold</p>
        <h1 className="text-3xl font-extrabold mt-1">
          {user?.isGold ? 'Bạn đang là Gold member' : 'Nâng tầm khoảnh khắc'}
        </h1>
        <p className="mt-2 text-white/90 text-sm max-w-md">
          Không ads · Unlimited friends · Themes · Streak restore · Insights
        </p>
        {user?.isGold && (
          <p className="mt-3 text-xs bg-white/20 inline-flex px-3 py-1 rounded-full">Ad-free enabled ✓ · Plan: {user.plan || 'active'}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/app/gold/customize" className="px-4 py-2 rounded-xl bg-white text-amber-800 text-sm font-bold">
            Tùy chỉnh Gold
          </Link>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 p-5 shadow-[var(--shadow-soft)]">
        <div className="flex justify-center mb-5">
          <div className="inline-flex p-1 rounded-full bg-slate-100 dark:bg-slate-800">
            {['monthly', 'yearly'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-5 py-2 rounded-full text-sm font-bold transition ${
                  period === p ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-500'
                }`}
              >
                {PLANS[p].label}
                {PLANS[p].save && <span className="ml-1 text-[10px] text-emerald-600">{PLANS[p].save}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="text-center">
          <p className="text-4xl font-extrabold">
            {plan.price.toLocaleString('vi-VN')}đ
            <span className="text-base font-semibold text-slate-400">{plan.period}</span>
          </p>
          {!user?.isGold ? (
            <button
              type="button"
              onClick={() => setCheckout(true)}
              className="mt-4 px-8 py-3.5 rounded-2xl gold-gradient text-white font-bold shadow-[var(--shadow-gold)]"
            >
              Nâng cấp Gold
            </button>
          ) : (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={cancel} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold">
                Hủy subscription
              </button>
              <button type="button" onClick={restore} disabled={loading} className="px-4 py-2 rounded-xl border border-amber-300 text-amber-700 text-sm font-semibold">
                Restore purchase
              </button>
            </div>
          )}
          {!user?.isGold && (
            <button type="button" onClick={restore} className="block mx-auto mt-2 text-xs text-slate-400 hover:text-amber-600">
              Restore purchase
            </button>
          )}
        </div>
      </div>

      {/* Comparison */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <h2 className="font-bold p-4 border-b border-slate-100 dark:border-slate-800">Free vs Gold</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="p-3 font-semibold">Tính năng</th>
                <th className="p-3 font-semibold">Free</th>
                <th className="p-3 font-semibold text-amber-600">Gold</th>
              </tr>
            </thead>
            <tbody>
              {FREE_VS_GOLD.map((row) => (
                <tr key={row.feature} className="border-t border-slate-50 dark:border-slate-800">
                  <td className="p-3 font-medium">{row.feature}</td>
                  <td className="p-3 text-slate-500">
                    {row.free === true ? <Check size={16} className="text-emerald-500" /> : row.free === false ? <X size={16} className="text-slate-300" /> : row.free}
                  </td>
                  <td className="p-3 text-amber-700 dark:text-amber-400 font-semibold">
                    {row.gold === true ? <Check size={16} className="text-amber-500" /> : row.gold}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Features list */}
      <div>
        <h2 className="font-bold mb-3">Tất cả quyền lợi Gold</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {GOLD_FEATURES.map((f) => (
            <div key={f.id} className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
              <p className="font-bold text-sm">{f.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature drops */}
      <div>
        <h2 className="font-bold mb-3">What&apos;s New in Gold</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {GOLD_DROPS.map((d) => (
            <div key={d.id} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-gradient-to-br from-white to-amber-50/50 dark:from-slate-900 dark:to-amber-500/5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">{d.month}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.status === 'live' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {d.status === 'live' ? 'Live' : 'Coming soon'}
                </span>
              </div>
              <p className="font-bold">{d.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{d.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Checkout modal */}
      <Modal
        open={checkout}
        onClose={() => setCheckout(false)}
        title="Mock checkout"
        footer={
          <button type="button" disabled={loading} onClick={pay} className="w-full py-3 rounded-xl gold-gradient text-white font-bold disabled:opacity-60">
            {loading ? 'Đang xử lý…' : `Thanh toán ${plan.price.toLocaleString('vi-VN')}đ`}
          </button>
        }
      >
        <p className="text-sm text-slate-500 mb-3">Đây là thanh toán giả lập — không trừ tiền thật.</p>
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm">
          <p className="font-bold">Piclet Gold · {plan.label}</p>
          <p className="text-slate-500">{plan.price.toLocaleString('vi-VN')}đ{plan.period}</p>
        </div>
        <input className="mt-3 w-full rounded-xl border px-3 py-2 text-sm" placeholder="Số thẻ (mock) 4242 …" defaultValue="4242 4242 4242 4242" />
      </Modal>

      {/* Success */}
      <Modal open={success} onClose={() => setSuccess(false)} title="Gold activated!">
        <div className="text-center py-6">
          <div className="text-5xl mb-3 gold-pulse">✨</div>
          <p className="font-extrabold text-xl gold-text">Chào mừng đến Piclet Gold</p>
          <p className="text-sm text-slate-500 mt-2">Toàn bộ tính năng premium đã mở khóa.</p>
          <Link
            to="/app/gold/customize"
            onClick={() => setSuccess(false)}
            className="inline-flex mt-5 px-6 py-3 rounded-xl gold-gradient text-white font-bold"
          >
            Tùy chỉnh ngay
          </Link>
        </div>
      </Modal>
    </div>
  )
}
