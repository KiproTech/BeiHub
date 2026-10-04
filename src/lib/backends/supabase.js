import { db, storage, signIn, signOut, getSession, onAuthChange } from '../supabase.js'
import { STORAGE_BUCKET } from '../config.js'
import { prepareImage } from '../image.js'
import { shapeProduct, shapeOrder, shapeSettings } from '../shape.js'

const PRODUCT_SELECT = '*,product_images(*),product_variants(*)'
const PRODUCT_FIELDS = ['category_id', 'name', 'slug', 'brand', 'short_description', 'description', 'specs', 'is_active', 'is_featured', 'is_popular', 'is_new']
const VARIANT_FIELDS = ['product_id', 'label', 'sku', 'price', 'previous_price', 'stock', 'availability', 'specs', 'sort_order']
const CATEGORY_FIELDS = ['name', 'slug', 'description', 'image_url', 'image_path', 'sort_order', 'is_active']
const LOCATION_FIELDS = ['county', 'town', 'fee', 'eta', 'is_active', 'sort_order']
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]))
const eq = (v) => `eq.${v}`
const first = (rows) => (Array.isArray(rows) ? rows[0] : rows)
const randomId = () => Math.random().toString(36).slice(2, 10)

async function upsertRow(table, id, payload) {
  if (id) {
    const rows = await db.update(table, { id: eq(id) }, payload)
    if (!rows.length) throw new Error('Could not save - you may not have permission.')
    return rows[0]
  }
  return first(await db.insert(table, payload))
}

async function uploadFile(file, folder) {
  const prepared = await prepareImage(file)
  const path = `${folder}/${Date.now()}-${randomId()}.${prepared.type === 'image/webp' ? 'webp' : 'jpg'}`
  const url = await storage.upload(STORAGE_BUCKET, path, prepared)
  return { url, path }
}

export const supabaseBackend = {
  name: 'supabase',

  /* ---------- public ---------- */
  async getStorefront() {
    const [settings, categories, locations, products] = await Promise.all([
      db.select('store_settings', { filters: { id: eq(1) } }),
      db.select('categories', { filters: { is_active: 'eq.true' }, order: 'sort_order.asc,name.asc' }),
      db.select('delivery_locations', { filters: { is_active: 'eq.true' }, order: 'sort_order.asc,county.asc' }),
      db.select('products', { select: PRODUCT_SELECT, filters: { is_active: 'eq.true' }, order: 'created_at.desc' }),
    ])
    return { settings: shapeSettings(settings[0]) || {}, categories, locations, products: products.map(shapeProduct) }
  },

  async submitOrder(customer, items) {
    const res = await db.rpc('submit_order', { p_customer: customer, p_items: items.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })) })
    return shapeOrder(res)
  },

  /* ---------- auth ---------- */
  async signIn(email, password) {
    await signIn(email, password)
    return this.getUser()
  },
  signOut,
  async getUser() {
    const s = getSession()
    if (!s?.user) return null
    let role = 'customer'
    try {
      const rows = await db.select('profiles', { filters: { id: eq(s.user.id) } })
      role = rows[0]?.role || 'customer'
    } catch {
      role = 'customer'
    }
    return { id: s.user.id, email: s.user.email, role }
  },
  onAuthChange,

  /* ---------- admin: catalogue ---------- */
  async adminLoad() {
    const [categories, products, settings, locations] = await Promise.all([
      db.select('categories', { order: 'sort_order.asc,name.asc' }),
      db.select('products', { select: PRODUCT_SELECT, order: 'created_at.desc' }),
      db.select('store_settings', { filters: { id: eq(1) } }),
      db.select('delivery_locations', { order: 'sort_order.asc,county.asc' }),
    ])
    return { categories, products: products.map(shapeProduct), settings: shapeSettings(settings[0]) || {}, locations }
  },

  async saveCategory(c) {
    return upsertRow('categories', c.id, pick(c, CATEGORY_FIELDS))
  },
  async deleteCategory(id) {
    const cat = first(await db.select('categories', { filters: { id: eq(id) } }))
    await db.remove('categories', { id: eq(id) })
    if (cat?.image_path) storage.remove(STORAGE_BUCKET, [cat.image_path]).catch(() => {})
  },
  async reorderCategories(ids) {
    await Promise.all(ids.map((id, i) => db.update('categories', { id: eq(id) }, { sort_order: (i + 1) * 10 })))
  },
  async uploadCategoryImage(file) {
    return uploadFile(file, 'categories')
  },

  async saveProduct(p) {
    const row = await upsertRow('products', p.id, pick(p, PRODUCT_FIELDS))
    const full = await db.select('products', { select: PRODUCT_SELECT, filters: { id: eq(row.id) } })
    return shapeProduct(full[0])
  },
  async deleteProduct(id) {
    const imgs = await db.select('product_images', { filters: { product_id: eq(id) } })
    await db.remove('products', { id: eq(id) })
    const paths = imgs.map((i) => i.storage_path).filter(Boolean)
    if (paths.length) storage.remove(STORAGE_BUCKET, paths).catch(() => {})
  },

  async saveVariant(v) {
    const payload = pick(v, VARIANT_FIELDS)
    payload.sku = payload.sku ? String(payload.sku).trim() : null
    return upsertRow('product_variants', v.id, payload)
  },
  async deleteVariant(id) {
    await db.remove('product_variants', { id: eq(id) })
  },

  async addImage(productId, file, sortOrder = 0) {
    const { url, path } = await uploadFile(file, `products/${productId}`)
    try {
      return first(await db.insert('product_images', { product_id: productId, url, storage_path: path, alt: '', sort_order: sortOrder }))
    } catch (e) {
      storage.remove(STORAGE_BUCKET, [path]).catch(() => {})
      throw e
    }
  },
  async replaceImage(image, file) {
    const { url, path } = await uploadFile(file, `products/${image.product_id}`)
    const rows = await db.update('product_images', { id: eq(image.id) }, { url, storage_path: path })
    if (!rows.length) throw new Error('Could not replace the image - you may not have permission.')
    if (image.storage_path) storage.remove(STORAGE_BUCKET, [image.storage_path]).catch(() => {})
    return rows[0]
  },
  async deleteImage(image) {
    await db.remove('product_images', { id: eq(image.id) })
    if (image.storage_path) storage.remove(STORAGE_BUCKET, [image.storage_path]).catch(() => {})
  },
  async setMainImage(image) {
    await db.rpc('set_main_image', { p_image_id: image.id })
  },
  async reorderImages(ids) {
    await Promise.all(ids.map((id, i) => db.update('product_images', { id: eq(id) }, { sort_order: i })))
  },

  /* ---------- admin: orders, settings, delivery ---------- */
  async listOrders() {
    const rows = await db.select('orders', { select: '*,order_items(*)', order: 'created_at.desc', limit: 1000 })
    return rows.map(shapeOrder)
  },
  async updateOrder(id, patch) {
    const rows = await db.update('orders', { id: eq(id) }, pick(patch, ['status', 'admin_notes']))
    if (!rows.length) throw new Error('Could not update the order - you may not have permission.')
    return rows[0]
  },
  async deleteOrder(id) {
    await db.remove('orders', { id: eq(id) })
  },
  async saveSettings(patch) {
    const { updated_at, ...rest } = patch
    void updated_at
    return shapeSettings(first(await db.insert('store_settings', { ...rest, id: 1 }, { onConflict: 'id' })))
  },
  async uploadBrandImage(file) {
    return uploadFile(file, 'branding')
  },
  async saveLocation(l) {
    const payload = pick(l, LOCATION_FIELDS)
    payload.town = payload.town ? String(payload.town).trim() : null
    return upsertRow('delivery_locations', l.id, payload)
  },
  async deleteLocation(id) {
    await db.remove('delivery_locations', { id: eq(id) })
  },
}
