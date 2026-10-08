import { availability, discountPercent } from './format.js'
import { matchProduct, tokenize } from './search.js'

export const SORTS = [
  { key: 'relevance', label: 'Best match' },
  { key: 'newest', label: 'Newest first' },
  { key: 'price_asc', label: 'Price: low to high' },
  { key: 'price_desc', label: 'Price: high to low' },
  { key: 'discount', label: 'Biggest discount' },
]

export const mainImage = (p) => (p.images || []).find((i) => i.is_main) || (p.images || [])[0] || null
export const productImages = (p) => {
  const imgs = [...(p.images || [])]
  const main = imgs.find((i) => i.is_main)
  return main ? [main, ...imgs.filter((i) => i !== main)] : imgs
}

const orderable = (v) => availability(v).canOrder
const byPrice = (a, b) => Number(orderable(b)) - Number(orderable(a)) || a.price - b.price

export const cheapestVariant = (p) => [...p.variants].sort(byPrice)[0] || { id: null, price: 0, previous_price: null }
export const priceRange = (p) => {
  const prices = p.variants.map((v) => v.price)
  return { min: Math.min(...prices), max: Math.max(...prices) }
}
export const bestDiscount = (p) => Math.max(0, ...p.variants.map((v) => discountPercent(v.previous_price, v.price)))

// Filter + sort the catalogue. Returns [{ product, variant, score }] where `variant`
// is the variant a card should show first (matching the search / filters / sort).
export function queryCatalog(products, catById, catBySlug, f = {}) {
  const tokens = tokenize(f.q || '')
  const catId = f.category ? catBySlug[f.category]?.id : null
  const min = f.min !== '' && f.min != null ? Number(f.min) : null
  const max = f.max !== '' && f.max != null ? Number(f.max) : null
  const rows = []
  for (const p of products) {
    if (catId && p.category_id !== catId) continue
    const m = matchProduct(p, catById[p.category_id]?.name || '', tokens)
    if (!m) continue
    const ids = new Set(m.variantIds)
    const cands = p.variants.filter((v) => {
      if (!ids.has(v.id)) return false
      if (f.size && v.label !== f.size) return false
      if (min != null && v.price < min) return false
      if (max != null && v.price > max) return false
      if (f.inStock && !['in', 'low'].includes(availability(v).key)) return false
      if (f.onSale && !discountPercent(v.previous_price, v.price)) return false
      return true
    })
    if (!cands.length) continue
    let shown = [...cands].sort(byPrice)[0]
    if (f.sort === 'price_desc') shown = [...cands].sort((a, b) => b.price - a.price)[0]
    if (f.sort === 'discount') shown = [...cands].sort((a, b) => discountPercent(b.previous_price, b.price) - discountPercent(a.previous_price, a.price))[0]
    rows.push({ product: p, variant: shown, score: m.score })
  }
  const sort = f.sort || (tokens.length ? 'relevance' : 'newest')
  const newest = (a, b) => String(b.product.created_at).localeCompare(String(a.product.created_at))
  const cmp = {
    relevance: (a, b) => b.score - a.score || newest(a, b),
    newest,
    price_asc: (a, b) => a.variant.price - b.variant.price || newest(a, b),
    price_desc: (a, b) => b.variant.price - a.variant.price || newest(a, b),
    discount: (a, b) => discountPercent(b.variant.previous_price, b.variant.price) - discountPercent(a.variant.previous_price, a.variant.price) || newest(a, b),
  }[sort] || newest
  return rows.sort(cmp)
}

const leadingNumber = (label) => {
  const m = String(label).replace(/,/g, '').match(/\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : Infinity
}

// distinct variant labels (sizes / capacities) in a set of products, with counts
export function sizeFacets(products) {
  const map = new Map()
  products.forEach((p) => p.variants.forEach((v) => map.set(v.label, (map.get(v.label) || 0) + 1)))
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => leadingNumber(a.label) - leadingNumber(b.label) || a.label.localeCompare(b.label))
}

export function productsOnSale(products) {
  return products.filter((p) => p.variants.some((v) => discountPercent(v.previous_price, v.price) > 0 && orderable(v)))
}
export const saleVariant = (p) =>
  [...p.variants].filter((v) => discountPercent(v.previous_price, v.price) > 0).sort((a, b) => discountPercent(b.previous_price, b.price) - discountPercent(a.previous_price, a.price))[0] || cheapestVariant(p)
