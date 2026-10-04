import { round2 } from './format.js'

// Mirrors public.compute_delivery_fee() in the database. The database result is the one
// that is saved on the order; this version is used for the live preview.
export function computeDeliveryFee(settings, locations, county, town, subtotal) {
  const s = settings || {}
  const mode = s.delivery_mode || 'free'
  if (mode === 'free') return 0
  if (s.free_delivery_threshold != null && s.free_delivery_threshold !== '' && subtotal >= Number(s.free_delivery_threshold)) return 0
  if (mode === 'fixed') return Number(s.fixed_delivery_fee) || 0
  const lc = (x) => String(x || '').trim().toLowerCase()
  const active = (locations || []).filter((l) => l.is_active !== false)
  if (mode === 'town' && town) {
    const hit = active.find((l) => l.town && lc(l.county) === lc(county) && lc(l.town) === lc(town))
    if (hit) return Number(hit.fee)
  }
  if (county) {
    const hit = active.find((l) => !l.town && lc(l.county) === lc(county))
    if (hit) return Number(hit.fee)
  }
  return Number(s.default_delivery_fee) || 0
}

export function orderTotals(subtotal, deliveryFee, depositPercent) {
  const total = round2(subtotal + deliveryFee)
  const deposit = round2((total * Number(depositPercent || 0)) / 100)
  return { subtotal: round2(subtotal), deliveryFee: round2(deliveryFee), total, deposit, balance: round2(total - deposit) }
}
