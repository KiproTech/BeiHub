const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
export const money = (n) => `KSh ${nf.format(Number(n) || 0)}`
export const num = (n) => nf.format(Number(n) || 0)
export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

export const discountPercent = (previous, price) => {
  const p = Number(previous)
  const c = Number(price)
  return p > c && c >= 0 ? Math.round(((p - c) / p) * 100) : 0
}

export const slugify = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// "Water Tank" + "2,000 Litres"  ->  "Water Tank — 2,000 Litres"
export const variantTitle = (product, variant) =>
  !variant || !variant.label || /^(standard|default)$/i.test(variant.label.trim())
    ? product.name
    : `${product.name} \u2014 ${variant.label}`

// effective availability of a variant, taking stock into account
export function availability(v) {
  if (!v) return { key: 'out', label: 'Unavailable', tone: 'bad', canOrder: false, max: 0 }
  if (v.availability === 'out_of_stock' || (v.availability === 'in_stock' && v.stock <= 0))
    return { key: 'out', label: 'Out of stock', tone: 'bad', canOrder: false, max: 0 }
  if (v.availability === 'on_order') return { key: 'order', label: 'Available on order', tone: 'warn', canOrder: true, max: 100 }
  if (v.stock <= 5) return { key: 'low', label: `Only ${v.stock} left`, tone: 'warn', canOrder: true, max: v.stock }
  return { key: 'in', label: 'In stock', tone: 'good', canOrder: true, max: Math.min(v.stock, 100) }
}

export const ORDER_STATUSES = [
  { key: 'pending', label: 'New - awaiting confirmation', short: 'New', tone: 'warn' },
  { key: 'confirmed', label: 'Confirmed - awaiting deposit', short: 'Confirmed', tone: 'info' },
  { key: 'deposit_paid', label: 'Deposit received', short: 'Deposit paid', tone: 'info' },
  { key: 'out_for_delivery', label: 'Out for delivery', short: 'Out for delivery', tone: 'info' },
  { key: 'delivered', label: 'Delivered', short: 'Delivered', tone: 'good' },
  { key: 'cancelled', label: 'Cancelled', short: 'Cancelled', tone: 'bad' },
]
export const statusInfo = (key) => ORDER_STATUSES.find((s) => s.key === key) || ORDER_STATUSES[0]

export const fmtDate = (d, withTime = false) => {
  if (!d) return '-'
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleString(
    'en-GB',
    withTime
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' },
  )
}

// Kenyan phone helpers
export const cleanPhone = (raw) => String(raw || '').replace(/[^\d+]/g, '')
export const isKenyanPhone = (raw) => /^(?:\+?254|0)?[17]\d{8}$/.test(cleanPhone(raw))
export function waDigits(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0')) d = '254' + d.slice(1)
  else if (/^[17]\d{8}$/.test(d)) d = '254' + d
  return d
}
