// Client-side product search. Handles typical shopper phrasing:
//   "2,000 litre tank", "55 inch samsung tv", "fridge", "solar battery", "wifi router"
const SYN = {
  fridg: ['refrigerator', 'freezer'],
  refrigerator: ['fridge'],
  freez: ['freezer', 'fridge'],
  tv: ['television'],
  television: ['tv'],
  laptop: ['notebook'],
  pc: ['computer', 'desktop'],
  computer: ['laptop', 'desktop'],
  wifi: ['router', 'wireless'],
  router: ['wifi'],
  cctv: ['camera', 'security'],
  camera: ['cctv'],
  inverter: ['ups'],
  genset: ['generator'],
  speaker: ['sound', 'audio'],
  earphone: ['earbuds'],
  headphone: ['earbuds'],
}
const NUMERIC = /^\d+(\.\d+)?$/

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/wi[\s-]?fi/g, 'wifi')
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/(\d)\s*["\u201d\u2033]/g, '$1 inch ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/(^|\s)\.+|\.+(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
const words = (text) => normalize(text).split(' ').filter(Boolean)

export function stem(t) {
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y'
  if (t.length > 4 && t.endsWith('es')) return t.slice(0, -2)
  if (t.length > 2 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1)
  return t
}

export const tokenize = (q) => normalize(q).split(' ').filter(Boolean)

const cache = new WeakMap()
const flatten = (obj) =>
  Object.entries(obj || {})
    .map(([k, v]) => `${k} ${v}`)
    .join(' ')

export function indexProduct(product, categoryName) {
  const hit = cache.get(product)
  if (hit && hit.cat === categoryName) return hit
  const nameW = new Set(words(`${product.name} ${product.brand || ''}`))
  const catW = new Set(words(categoryName || ''))
  const otherW = new Set(words(`${product.short_description || ''} ${product.description || ''} ${flatten(product.specs)}`))
  const variants = (product.variants || []).map((v) => ({
    id: v.id,
    words: new Set(words(`${v.label} ${v.sku || ''} ${flatten(v.specs)}`)),
  }))
  const idx = { cat: categoryName, nameW, catW, otherW, variants }
  cache.set(product, idx)
  return idx
}

const hasWord = (set, alt) => {
  if (NUMERIC.test(alt)) return set.has(alt)
  for (const w of set) if (w.startsWith(alt)) return true
  return false
}

function tokenAlts(t) {
  if (NUMERIC.test(t)) return [t]
  const s = stem(t)
  return [s, ...(SYN[s] || [])]
}

// Returns { score, variantIds } or null when the product does not match every search word.
export function matchProduct(product, categoryName, tokens) {
  if (!tokens.length) return { score: 0, variantIds: (product.variants || []).map((v) => v.id) }
  const idx = indexProduct(product, categoryName)
  const altList = tokens.map(tokenAlts)
  let base = 0
  const needVariant = []
  for (const alts of altList) {
    let s = 0
    for (const a of alts) {
      if (hasWord(idx.nameW, a)) s = Math.max(s, 3)
      else if (hasWord(idx.catW, a)) s = Math.max(s, 2)
      else if (!NUMERIC.test(a) && hasWord(idx.otherW, a)) s = Math.max(s, 1)
    }
    base += s
    needVariant.push(s === 0)
  }
  const variantIds = []
  for (const v of idx.variants) {
    const ok = altList.every((alts, i) => !needVariant[i] || alts.some((a) => hasWord(v.words, a)))
    if (ok) variantIds.push(v.id)
  }
  if (!variantIds.length) return null
  return { score: base + needVariant.filter(Boolean).length * 2, variantIds }
}
