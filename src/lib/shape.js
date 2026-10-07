// Normalise database rows into the shapes the UI uses.
const bySort = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at || '').localeCompare(String(b.created_at || ''))

export const shapeVariant = (v) => ({
  ...v,
  price: Number(v.price),
  previous_price: v.previous_price == null ? null : Number(v.previous_price),
  stock: Number(v.stock) || 0,
  specs: v.specs || {},
})

export function shapeProduct(row) {
  const { product_images, product_variants, ...rest } = row
  return {
    ...rest,
    specs: rest.specs || {},
    images: [...(row.images || product_images || [])].sort(bySort),
    variants: [...(row.variants || product_variants || [])].sort(bySort).map((v) => ({ ...shapeVariant(v), product_status: rest.status || 'available' })),
  }
}

const byTime = (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || ''))

export const shapeOrder = (o) => ({
  ...o,
  status: o.status || 'pending',
  payment_status: o.payment_status || 'unpaid',
  fulfilment_method: o.fulfilment_method || 'delivery',
  events: [...(o.events || o.order_events || [])].sort(byTime),
  subtotal: Number(o.subtotal),
  delivery_fee: Number(o.delivery_fee),
  total: Number(o.total),
  deposit_amount: Number(o.deposit_amount),
  balance_amount: Number(o.balance_amount),
  deposit_percent: Number(o.deposit_percent),
  items: (o.items || o.order_items || []).map((i) => ({ ...i, unit_price: Number(i.unit_price), quantity: Number(i.quantity), line_total: Number(i.line_total ?? i.unit_price * i.quantity) })),
})

export const shapeSettings = (s) =>
  s && {
    ...s,
    deposit_percent: Number(s.deposit_percent),
    fixed_delivery_fee: Number(s.fixed_delivery_fee),
    default_delivery_fee: Number(s.default_delivery_fee),
    free_delivery_threshold: s.free_delivery_threshold == null ? null : Number(s.free_delivery_threshold),
  }
