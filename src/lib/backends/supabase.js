import { db, storage, signIn, signOut, signUp, resendVerification, recoverPassword, updatePassword, refreshAuthUser, takeAuthEvent, getSession, onAuthChange } from '../supabase.js'
import { STORAGE_BUCKET } from '../config.js'
import { prepareImage } from '../image.js'
import { shapeProduct, shapeOrder, shapeSettings } from '../shape.js'

const PRODUCT_SELECT = '*,product_images(*),product_variants(*)'
const ORDER_SELECT = '*,order_items(*),order_events(*)'
const PRODUCT_FIELDS = ['category_id', 'name', 'slug', 'brand', 'short_description', 'description', 'specs', 'status', 'is_active', 'is_featured', 'is_popular', 'is_new']
const VARIANT_FIELDS = ['product_id', 'label', 'sku', 'price', 'previous_price', 'stock', 'availability', 'specs', 'sort_order']
const CATEGORY_FIELDS = ['name', 'slug', 'description', 'image_url', 'image_path', 'sort_order', 'is_active']
const LOCATION_FIELDS = ['county', 'town', 'fee', 'eta', 'is_active', 'sort_order']
// Business information: the ONLY fields the admin can write on the single store_settings record.
const SETTINGS_FIELDS = ['business_name', 'tagline', 'phone', 'whatsapp', 'email', 'address', 'county', 'business_hours', 'about', 'delivery_info',
  'payment_instructions', 'deposit_percent', 'delivery_mode', 'fixed_delivery_fee', 'default_delivery_fee', 'free_delivery_threshold',
  'facebook_url', 'instagram_url', 'twitter_url', 'tiktok_url', 'youtube_url', 'google_maps_url',
  'support_phone', 'support_email', 'support_hours', 'other_contact_info']
const PROFILE_FIELDS = ['full_name', 'phone', 'alternative_phone', 'preferred_contact']
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]))
const eq = (v) => `eq.${v}`
const first = (rows) => (Array.isArray(rows) ? rows[0] : rows)
const randomId = () => Math.random().toString(36).slice(2, 10)
const removeFiles = (paths) => storage.remove(STORAGE_BUCKET, (paths || []).filter(Boolean)).catch(() => {})

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
    const [settings, categories, locations, products, media] = await Promise.all([
      db.select('store_settings', { filters: { id: eq(1) } }),
      db.select('categories', { filters: { is_active: 'eq.true' }, order: 'sort_order.asc,name.asc' }),
      db.select('delivery_locations', { filters: { is_active: 'eq.true' }, order: 'sort_order.asc,county.asc' }),
      db.select('products', { select: PRODUCT_SELECT, filters: { is_active: 'eq.true' }, order: 'created_at.desc' }),
      db.select('site_media', { filters: { is_active: 'eq.true' }, order: 'sort_order.asc,created_at.asc' }),
    ])
    return {
      settings: shapeSettings(settings[0]) || {},
      categories,
      locations,
      media,
      products: products.map(shapeProduct),
    }
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
  signUp: (email, password, meta) => signUp(email, password, meta),
  resendVerification,
  recoverPassword,
  updatePassword,
  takeAuthEvent,
  signOut,
  async getUser() {
    let s = getSession()
    if (!s) return null
    if (!s.user) {
      try {
        await refreshAuthUser()
      } catch {
        return null
      }
      s = getSession()
    }
    if (!s?.user) return null
    let profile = {}
    try {
      profile = (await db.select('profiles', { filters: { id: eq(s.user.id) } }))[0] || {}
    } catch {
      profile = {}
    }
    return {
      id: s.user.id,
      email: s.user.email,
      role: profile.role || 'customer',
      email_verified: !!s.user.email_confirmed_at,
      full_name: profile.full_name || s.user.user_metadata?.full_name || '',
      phone: profile.phone || '',
      alternative_phone: profile.alternative_phone || '',
      preferred_contact: profile.preferred_contact || 'phone',
      suspended: !!profile.is_suspended,
    }
  },
  async checkVerified() {
    const u = await refreshAuthUser()
    return !!u?.email_confirmed_at
  },
  async updateProfile(patch) {
    const s = getSession()
    const rows = await db.update('profiles', { id: eq(s.user.id) }, pick(patch, PROFILE_FIELDS))
    if (!rows.length) throw new Error('Could not save your profile.')
    return rows[0]
  },
  onAuthChange,

  /* ---------- customer: my orders + notifications ---------- */
  async listMyOrders() {
    const s = getSession()
    if (!s?.user) return []
    const rows = await db.select('orders', { select: ORDER_SELECT, filters: { user_id: eq(s.user.id) }, order: 'created_at.desc', limit: 200 })
    return rows.map(shapeOrder)
  },
  async cancelMyOrder(id, reason) {
    return shapeOrder(await db.rpc('customer_cancel_order', { p_order_id: id, p_reason: reason || '' }))
  },
  async listNotifications() {
    return db.select('notifications', { order: 'created_at.desc', limit: 100 })
  },
  async markNotificationsRead(ids) {
    const now = new Date().toISOString()
    if (ids && ids.length) await db.update('notifications', { id: `in.(${ids.join(',')})` }, { is_read: true, read_at: now })
    else await db.update('notifications', { is_read: 'eq.false' }, { is_read: true, read_at: now })
  },

  /* ---------- admin: catalogue ---------- */
  async adminLoad() {
    const [categories, products, settings, locations, media, reasons, updates] = await Promise.all([
      db.select('categories', { order: 'sort_order.asc,name.asc' }),
      db.select('products', { select: PRODUCT_SELECT, order: 'created_at.desc' }),
      db.select('store_settings', { filters: { id: eq(1) } }),
      db.select('delivery_locations', { order: 'sort_order.asc,county.asc' }),
      db.select('site_media', { order: 'slot.asc,sort_order.asc,created_at.asc' }),
      db.select('order_cancellation_reasons', { filters: { is_active: 'eq.true' }, order: 'sort_order.asc' }),
      db.select('order_update_templates', { filters: { is_active: 'eq.true' }, order: 'sort_order.asc' }),
    ])
    return { categories, products: products.map(shapeProduct), settings: shapeSettings(settings[0]) || {}, locations, media, cancelReasons: reasons, updateTemplates: updates }
  },

  async saveCategory(c) {
    const old = c.id && 'image_path' in c ? first(await db.select('categories', { filters: { id: eq(c.id) } })) : null
    const row = await upsertRow('categories', c.id, pick(c, CATEGORY_FIELDS))
    // an image that was replaced or removed must not stay behind in storage
    if (old?.image_path && old.image_path !== row.image_path) removeFiles([old.image_path])
    return row
  },
  async deleteCategory(id) {
    const cat = first(await db.select('categories', { filters: { id: eq(id) } }))
    await db.remove('categories', { id: eq(id) })
    if (cat?.image_path) removeFiles([cat.image_path])
  },
  async reorderCategories(ids) {
    await Promise.all(ids.map((id, i) => db.update('categories', { id: eq(id) }, { sort_order: (i + 1) * 10 })))
  },
  async uploadCategoryImage(file) {
    return uploadFile(file, 'categories')
  },

  async saveProduct(p) {
    const payload = pick(p, PRODUCT_FIELDS)
    // `status` is the source of truth; the database keeps is_active in sync
    if ('status' in payload) delete payload.is_active
    const row = await upsertRow('products', p.id, payload)
    const full = await db.select('products', { select: PRODUCT_SELECT, filters: { id: eq(row.id) } })
    return shapeProduct(full[0])
  },
  async deleteProduct(id) {
    const imgs = await db.select('product_images', { filters: { product_id: eq(id) } })
    await db.remove('products', { id: eq(id) })
    removeFiles(imgs.map((i) => i.storage_path))
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
      removeFiles([path])
      throw e
    }
  },
  async replaceImage(image, file) {
    const { url, path } = await uploadFile(file, `products/${image.product_id}`)
    const rows = await db.update('product_images', { id: eq(image.id) }, { url, storage_path: path })
    if (!rows.length) {
      removeFiles([path])
      throw new Error('Could not replace the image - you may not have permission.')
    }
    removeFiles([image.storage_path])
    return rows[0]
  },
  async deleteImage(image) {
    await db.remove('product_images', { id: eq(image.id) })
    removeFiles([image.storage_path])
  },
  async setMainImage(image) {
    await db.rpc('set_main_image', { p_image_id: image.id })
  },
  async reorderImages(ids) {
    await Promise.all(ids.map((id, i) => db.update('product_images', { id: eq(id) }, { sort_order: i })))
  },

  /* ---------- admin: site media ---------- */
  async addMedia(slot, file, meta = {}) {
    const { url, path } = await uploadFile(file, `site/${slot}`)
    try {
      return first(await db.insert('site_media', { slot, url, storage_path: path, title: meta.title || null, alt: meta.alt || null }))
    } catch (e) {
      removeFiles([path])
      throw e
    }
  },
  async replaceMedia(item, file) {
    const { url, path } = await uploadFile(file, `site/${item.slot}`)
    const rows = await db.update('site_media', { id: eq(item.id) }, { url, storage_path: path })
    if (!rows.length) {
      removeFiles([path])
      throw new Error('Could not replace the image - you may not have permission.')
    }
    removeFiles([item.storage_path])
    return rows[0]
  },
  async deleteMedia(item) {
    await db.remove('site_media', { id: eq(item.id) }) // the database promotes the next image and clears store_settings.logo_url
    removeFiles([item.storage_path])
  },
  async setPrimaryMedia(item) {
    await db.rpc('set_primary_site_media', { p_media_id: item.id })
  },
  async updateMedia(id, patch) {
    const rows = await db.update('site_media', { id: eq(id) }, pick(patch, ['title', 'alt', 'is_active', 'sort_order']))
    if (!rows.length) throw new Error('Could not save - you may not have permission.')
    return rows[0]
  },

  /* ---------- admin: orders, settings, delivery, audit ---------- */
  async listOrders() {
    const rows = await db.select('orders', { select: ORDER_SELECT, order: 'created_at.desc', limit: 1000 })
    return rows.map(shapeOrder)
  },
  // reasonCode = a predefined cancellation reason (required when cancelling); reason = the "Other, please specify" text;
  // updateCode = a predefined customer message; message = optional extra sentence.
  async setOrderStatus(id, status, { reason, message, reasonCode, updateCode } = {}) {
    return db.rpc('admin_set_order_status', {
      p_order_id: id, p_status: status, p_reason: reason || null, p_message: message || null,
      p_reason_code: reasonCode || null, p_update_code: updateCode || null,
    })
  },
  async sendOrderUpdate(id, { updateCode, message } = {}) {
    return db.rpc('admin_send_order_update', { p_order_id: id, p_update_code: updateCode || null, p_message: message || null })
  },
  async setPaymentStatus(id, paymentStatus, message) {
    return db.rpc('admin_set_payment_status', { p_order_id: id, p_payment_status: paymentStatus, p_message: message || null })
  },
  async addOrderNote(id, note) {
    await db.rpc('admin_add_order_note', { p_order_id: id, p_note: note })
  },
  async deleteOrder(id) {
    await db.remove('orders', { id: eq(id) })
  },
  async listAudit() {
    return db.select('audit_log', { order: 'created_at.desc', limit: 500 })
  },
  // `changes` holds ONLY the fields the admin edited; `baseline` is the settings the admin was looking at.
  // Untouched fields are never sent, so a stale screen can never overwrite them. If someone else already changed
  // one of the edited fields, nothing is saved and the admin is told (instead of silently overwriting that change).
  async saveSettings(changes, baseline) {
    const payload = pick(changes, SETTINGS_FIELDS)
    if (!Object.keys(payload).length) return null
    const norm = (v) => (v == null || v === '' ? '' : Number.isNaN(Number(v)) ? String(v).trim() : String(Number(v)))
    const cur = first(await db.select('store_settings', { filters: { id: eq(1) } }))
    if (cur && baseline) {
      for (const k of Object.keys(payload)) if (norm(cur[k]) !== norm(baseline[k])) throw new Error('SETTINGS_CONFLICT')
    }
    const filters = { id: eq(1) }
    if (cur?.updated_at) filters.updated_at = eq(cur.updated_at) // guards the moment between reading and writing
    const rows = await db.update('store_settings', filters, payload)
    if (!rows.length) throw new Error('SETTINGS_CONFLICT')
    return shapeSettings(rows[0])
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
