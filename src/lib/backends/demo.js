// Demo backend: the whole shop runs in this browser (localStorage). Nothing is sent anywhere.
// It exposes exactly the same methods as the Supabase backend.
import { CATEGORIES, PRODUCTS, SETTINGS, DELIVERY_LOCATIONS, variantSku, imageFiles, categoryImage } from '../../data/catalog.js'
import { DEMO_ADMIN } from '../config.js'
import { computeDeliveryFee, orderTotals } from '../pricing.js'
import { prepareImage, fileToDataUrl } from '../image.js'
import { shapeProduct, shapeOrder } from '../shape.js'
import { round2 } from '../format.js'

const KEY = 'beihub.demo.v1'
const AUTH = 'beihub.demo.auth'
const listeners = new Set()
const clone = (x) => JSON.parse(JSON.stringify(x))
const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 10)}`
const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString()

function seed() {
  const cats = CATEGORIES.map((c, i) => ({
    id: `cat-${c.slug}`, name: c.name, slug: c.slug, description: c.description, image_url: categoryImage(c), image_path: null,
    sort_order: (i + 1) * 10, is_active: true, created_at: iso(), updated_at: iso(),
  }))
  const products = PRODUCTS.map((p, pi) => ({
    id: `prod-${p.slug}`, category_id: `cat-${p.category}`, name: p.name, slug: p.slug, brand: p.brand, short_description: p.short,
    description: p.description, specs: p.specs, is_active: true, is_featured: p.featured, is_popular: p.popular, is_new: p.isNew,
    created_at: iso((pi + 1) * 3600e3), updated_at: iso(),
    images: imageFiles(p).map((url, i) => ({ id: `img-${p.slug}-${i}`, product_id: `prod-${p.slug}`, url, storage_path: null, alt: i ? `${p.name} - detail view` : p.name, sort_order: i, is_main: i === 0, created_at: iso() })),
    variants: p.variants.map((v, i) => ({
      id: `var-${p.slug}-${i}`, product_id: `prod-${p.slug}`, label: v.label, sku: variantSku(p, v), price: v.price, previous_price: v.prev, stock: v.stock,
      availability: v.avail, specs: { [p.variantKey]: v.label }, sort_order: i, created_at: iso(), updated_at: iso(),
    })),
  }))
  const state = {
    categories: cats,
    products,
    settings: { id: 1, logo_url: null, ...clone(SETTINGS) },
    locations: DELIVERY_LOCATIONS.map((d, i) => ({ id: `loc-${i}`, county: d.county, town: d.town, fee: d.fee, eta: d.eta, is_active: true, sort_order: (i + 1) * 10, created_at: iso() })),
    orders: [],
    orderSeq: 1000,
  }
  // a few sample orders so the admin dashboard is not empty
  const mk = (variantIds, customer, status, hoursAgo) => {
    const items = variantIds.map(([pslug, vi, qty]) => {
      const p = products.find((x) => x.slug === pslug)
      const v = p.variants[vi]
      return { id: uid('oi'), product_id: p.id, variant_id: v.id, product_name: p.name, variant_label: v.label, sku: v.sku, image_url: p.images[0].url, unit_price: v.price, quantity: qty, line_total: v.price * qty }
    })
    const subtotal = items.reduce((a, i) => a + i.line_total, 0)
    const fee = computeDeliveryFee(state.settings, state.locations, customer.county, customer.town, subtotal)
    const t = orderTotals(subtotal, fee, state.settings.deposit_percent)
    state.orderSeq += 1
    state.orders.unshift({
      id: uid('ord'), order_number: `BH-${new Date().toISOString().slice(2, 4)}${new Date().toISOString().slice(5, 7)}-${String(state.orderSeq).padStart(5, '0')}`,
      status, ...customer, preferred_delivery_date: null, notes: '', subtotal: t.subtotal, delivery_fee: t.deliveryFee, total: t.total,
      deposit_percent: state.settings.deposit_percent, deposit_amount: t.deposit, balance_amount: t.balance, admin_notes: '', created_at: iso(hoursAgo * 3600e3), updated_at: iso(), items,
    })
  }
  mk([['water-tank', 6, 1], ['tank-fittings-kit', 1, 1]], { customer_name: 'Grace Wanjiru', phone: '0712 345 678', whatsapp: '0712 345 678', county: 'Kiambu', town: 'Thika', delivery_location: 'Section 9, near the Total petrol station' }, 'pending', 2)
  mk([['samsung-4k-uhd-smart-tv', 2, 1], ['soundbar-with-subwoofer', 0, 1]], { customer_name: 'Peter Otieno', phone: '0722 111 222', whatsapp: '', county: 'Kisumu', town: 'Milimani', delivery_location: 'Milimani Estate, Block C' }, 'confirmed', 20)
  mk([['monocrystalline-solar-panel', 2, 4], ['hybrid-solar-inverter', 1, 1], ['deep-cycle-solar-battery', 1, 2]], { customer_name: 'Mary Achieng', phone: '0733 987 654', whatsapp: '0733 987 654', county: 'Kakamega', town: 'Mumias', delivery_location: 'Mumias-Butere Road, 2km from town' }, 'deposit_paid', 50)
  mk([['business-laptop-15', 1, 2]], { customer_name: 'John Kamau', phone: '0700 555 444', whatsapp: '', county: 'Nairobi', town: 'CBD', delivery_location: 'Moi Avenue, Pioneer House 4th floor' }, 'delivered', 120)
  return state
}

let state
try {
  state = JSON.parse(localStorage.getItem(KEY) || 'null')
} catch {
  state = null
}
if (!state || !state.products) state = seed()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    throw new Error('Demo storage is full. Delete some uploaded images or reset the demo data in Settings.')
  }
}
const notify = () => {
  const u = readUser()
  listeners.forEach((fn) => fn(u ? { user: { id: u.id, email: u.email } } : null))
}
function readUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH) || 'null')
  } catch {
    return null
  }
}
const findProduct = (id) => state.products.find((p) => p.id === id)
const needAdmin = () => {
  if (!readUser()) throw Object.assign(new Error('Not authorised.'), { code: '42501' })
}
const sorted = (arr) => [...arr].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
function allSkus(exceptId) {
  return state.products.flatMap((p) => p.variants).filter((v) => v.id !== exceptId && v.sku).map((v) => v.sku.toLowerCase())
}

export const demoBackend = {
  name: 'demo',

  async getStorefront() {
    const activeCats = state.categories.filter((c) => c.is_active)
    return clone({
      settings: state.settings,
      categories: sorted(activeCats),
      locations: sorted(state.locations.filter((l) => l.is_active)),
      products: state.products.filter((p) => p.is_active).map(shapeProduct),
    })
  },

  async submitOrder(customer, items) {
    const must = ['customer_name', 'phone', 'county', 'town', 'delivery_location']
    if (must.some((k) => !String(customer[k] || '').trim())) throw new Error('Please fill in your name, phone, county, town and delivery location.')
    if (!items?.length) throw new Error('Your order list is empty.')
    const lines = items.map((it) => {
      const qty = Number(it.quantity)
      if (!(qty >= 1 && qty <= 100)) throw new Error('Invalid quantity.')
      const p = state.products.find((x) => x.is_active && x.variants.some((v) => v.id === it.variant_id))
      if (!p) throw new Error('A product in your list is no longer available. Please refresh the page and try again.')
      const v = p.variants.find((x) => x.id === it.variant_id)
      if (v.availability === 'out_of_stock' || (v.availability === 'in_stock' && v.stock <= 0)) throw new Error(`${p.name} (${v.label}) is currently out of stock.`)
      if (v.availability === 'in_stock' && qty > v.stock) throw new Error(`Only ${v.stock} of ${p.name} (${v.label}) left in stock.`)
      const img = [...p.images].sort((a, b) => Number(b.is_main) - Number(a.is_main) || a.sort_order - b.sort_order)[0]
      return { id: uid('oi'), product_id: p.id, variant_id: v.id, product_name: p.name, variant_label: v.label, sku: v.sku, image_url: img?.url || null, unit_price: v.price, quantity: qty, line_total: round2(v.price * qty) }
    })
    const subtotal = lines.reduce((a, l) => a + l.line_total, 0)
    const fee = computeDeliveryFee(state.settings, state.locations, customer.county, customer.town, subtotal)
    const t = orderTotals(subtotal, fee, state.settings.deposit_percent)
    state.orderSeq += 1
    const d = new Date()
    const order = {
      id: uid('ord'),
      order_number: `BH-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${String(state.orderSeq).padStart(5, '0')}`,
      status: 'pending',
      customer_name: customer.customer_name.trim(), phone: customer.phone.trim(), whatsapp: (customer.whatsapp || '').trim() || null,
      county: customer.county.trim(), town: customer.town.trim(), delivery_location: customer.delivery_location.trim(),
      preferred_delivery_date: customer.preferred_delivery_date || null, notes: (customer.notes || '').trim() || null,
      subtotal: t.subtotal, delivery_fee: t.deliveryFee, total: t.total, deposit_percent: state.settings.deposit_percent,
      deposit_amount: t.deposit, balance_amount: t.balance, admin_notes: '', created_at: iso(), updated_at: iso(), items: lines,
    }
    state.orders.unshift(order)
    persist()
    return shapeOrder(clone(order))
  },

  /* ---------- auth ---------- */
  async signIn(email, password) {
    if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) throw new Error('Invalid login credentials')
    localStorage.setItem(AUTH, JSON.stringify({ id: 'demo-admin', email: DEMO_ADMIN.email }))
    notify()
    return this.getUser()
  },
  async signOut() {
    localStorage.removeItem(AUTH)
    notify()
  },
  async getUser() {
    const u = readUser()
    return u ? { ...u, role: 'admin' } : null
  },
  onAuthChange(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  /* ---------- admin ---------- */
  async adminLoad() {
    needAdmin()
    return clone({
      categories: sorted(state.categories),
      products: state.products.map(shapeProduct),
      settings: state.settings,
      locations: sorted(state.locations),
    })
  },

  async saveCategory(c) {
    needAdmin()
    if ((!c.id || 'name' in c) && !c.name?.trim()) throw new Error('Category name is required.')
    if (c.slug && state.categories.some((x) => x.slug === c.slug && x.id !== c.id)) throw Object.assign(new Error('duplicate key value violates unique constraint "categories_slug_key"'), { code: '23505' })
    if (c.id) {
      const row = state.categories.find((x) => x.id === c.id)
      Object.assign(row, c, { updated_at: iso() })
      persist()
      return clone(row)
    }
    const { id: _ignored, ...rest } = c
    void _ignored
    const row = { id: uid('cat'), image_url: null, image_path: null, description: '', is_active: true, created_at: iso(), updated_at: iso(), ...rest, sort_order: (Math.max(0, ...state.categories.map((x) => x.sort_order)) || 0) + 10 }
    state.categories.push(row)
    persist()
    return clone(row)
  },
  async deleteCategory(id) {
    needAdmin()
    if (state.products.some((p) => p.category_id === id)) throw Object.assign(new Error('violates foreign key constraint on categories'), { code: '23503' })
    state.categories = state.categories.filter((c) => c.id !== id)
    persist()
  },
  async reorderCategories(ids) {
    needAdmin()
    ids.forEach((id, i) => {
      const c = state.categories.find((x) => x.id === id)
      if (c) c.sort_order = (i + 1) * 10
    })
    persist()
  },
  async uploadCategoryImage(file) {
    needAdmin()
    const url = await fileToDataUrl(await prepareImage(file, { max: 900 }))
    return { url, path: null }
  },

  async saveProduct(p) {
    needAdmin()
    if ((!p.id || 'name' in p) && !p.name?.trim()) throw new Error('Product name is required.')
    if ((!p.id || 'category_id' in p) && !p.category_id) throw new Error('Choose a category.')
    if (p.slug && state.products.some((x) => x.slug === p.slug && x.id !== p.id)) throw Object.assign(new Error('duplicate key value violates unique constraint "products_slug_key"'), { code: '23505' })
    const fields = ['category_id', 'name', 'slug', 'brand', 'short_description', 'description', 'specs', 'is_active', 'is_featured', 'is_popular', 'is_new']
    const data = Object.fromEntries(fields.filter((k) => k in p).map((k) => [k, p[k]]))
    let row
    if (p.id) {
      row = findProduct(p.id)
      Object.assign(row, data, { updated_at: iso() })
    } else {
      row = { id: uid('prod'), created_at: iso(), updated_at: iso(), images: [], variants: [], ...data }
      state.products.unshift(row)
    }
    persist()
    return shapeProduct(clone(row))
  },
  async deleteProduct(id) {
    needAdmin()
    state.products = state.products.filter((p) => p.id !== id)
    persist()
  },

  async saveVariant(v) {
    needAdmin()
    const p = findProduct(v.product_id)
    if (!p) throw new Error('Save the product first.')
    if (!String(v.label || '').trim()) throw new Error('Variant name is required (for example "2,000 Litres").')
    if (!(Number(v.price) >= 0)) throw new Error('Enter a valid price.')
    const sku = v.sku ? String(v.sku).trim() : null
    if (sku && allSkus(v.id).includes(sku.toLowerCase())) throw Object.assign(new Error('duplicate key value violates unique constraint "product_variants_sku_key"'), { code: '23505' })
    if (p.variants.some((x) => x.id !== v.id && x.label.toLowerCase() === v.label.trim().toLowerCase())) throw Object.assign(new Error('duplicate key value violates unique constraint "product_variants_product_id_label_key"'), { code: '23505' })
    const data = {
      product_id: v.product_id, label: v.label.trim(), sku, price: Number(v.price),
      previous_price: v.previous_price === '' || v.previous_price == null ? null : Number(v.previous_price),
      stock: Math.max(0, parseInt(v.stock, 10) || 0), availability: v.availability || 'in_stock', specs: v.specs || {}, sort_order: v.sort_order ?? p.variants.length,
    }
    let row
    if (v.id) {
      row = p.variants.find((x) => x.id === v.id)
      Object.assign(row, data, { updated_at: iso() })
    } else {
      row = { id: uid('var'), created_at: iso(), updated_at: iso(), ...data }
      p.variants.push(row)
    }
    persist()
    return clone(row)
  },
  async deleteVariant(id) {
    needAdmin()
    state.products.forEach((p) => {
      p.variants = p.variants.filter((v) => v.id !== id)
    })
    persist()
  },

  async addImage(productId, file, sortOrder = 0) {
    needAdmin()
    const p = findProduct(productId)
    const url = await fileToDataUrl(await prepareImage(file, { max: 1000, quality: 0.8 }))
    const img = { id: uid('img'), product_id: productId, url, storage_path: null, alt: '', sort_order: sortOrder, is_main: !p.images.some((i) => i.is_main), created_at: iso() }
    p.images.push(img)
    persist()
    return clone(img)
  },
  async replaceImage(image, file) {
    needAdmin()
    const p = findProduct(image.product_id)
    const img = p.images.find((i) => i.id === image.id)
    img.url = await fileToDataUrl(await prepareImage(file, { max: 1000, quality: 0.8 }))
    persist()
    return clone(img)
  },
  async deleteImage(image) {
    needAdmin()
    const p = findProduct(image.product_id)
    const wasMain = p.images.find((i) => i.id === image.id)?.is_main
    p.images = p.images.filter((i) => i.id !== image.id)
    if (wasMain && p.images[0]) sorted(p.images)[0].is_main = true
    persist()
  },
  async setMainImage(image) {
    needAdmin()
    const p = findProduct(image.product_id)
    p.images.forEach((i) => {
      i.is_main = i.id === image.id
    })
    persist()
  },
  async reorderImages(ids) {
    needAdmin()
    state.products.forEach((p) =>
      p.images.forEach((i) => {
        const idx = ids.indexOf(i.id)
        if (idx >= 0) i.sort_order = idx
      }),
    )
    persist()
  },

  async listOrders() {
    needAdmin()
    return clone(state.orders).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).map(shapeOrder)
  },
  async updateOrder(id, patch) {
    needAdmin()
    const o = state.orders.find((x) => x.id === id)
    if (patch.status) o.status = patch.status
    if ('admin_notes' in patch) o.admin_notes = patch.admin_notes
    o.updated_at = iso()
    persist()
    return clone(o)
  },
  async deleteOrder(id) {
    needAdmin()
    state.orders = state.orders.filter((o) => o.id !== id)
    persist()
  },
  async saveSettings(patch) {
    needAdmin()
    state.settings = { ...state.settings, ...patch, id: 1 }
    persist()
    return clone(state.settings)
  },
  async uploadBrandImage(file) {
    needAdmin()
    const url = await fileToDataUrl(await prepareImage(file, { max: 500 }))
    return { url, path: null }
  },
  async saveLocation(l) {
    needAdmin()
    const town = l.town ? String(l.town).trim() : null
    const dup = state.locations.some((x) => x.id !== l.id && x.county.toLowerCase() === l.county.trim().toLowerCase() && (x.town || '').toLowerCase() === (town || '').toLowerCase())
    if (dup) throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })
    const data = { county: l.county.trim(), town, fee: Number(l.fee) || 0, eta: l.eta || '', is_active: l.is_active !== false, sort_order: l.sort_order ?? 0 }
    if (l.id) {
      const row = state.locations.find((x) => x.id === l.id)
      Object.assign(row, data)
      persist()
      return clone(row)
    }
    const row = { id: uid('loc'), created_at: iso(), ...data, sort_order: Math.max(0, ...state.locations.map((x) => x.sort_order)) + 10 }
    state.locations.push(row)
    persist()
    return clone(row)
  },
  async deleteLocation(id) {
    needAdmin()
    state.locations = state.locations.filter((l) => l.id !== id)
    persist()
  },

  async resetDemo() {
    state = seed()
    persist()
  },
}
