import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { friendlyError } from '../lib/errors.js'
import { setDefaultImages } from '../components/ui.jsx'
import { useLiveRefresh } from '../lib/realtime.js'
import { categoryCounts, visibleCategories } from '../lib/catalogQuery.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

// Everything below comes from Supabase. These values are only what the UI shows for the split second
// before the first answer arrives (brand name) or what the maths needs to stay safe (delivery_mode).
const BEFORE_FIRST_LOAD = { business_name: 'BeiHub', delivery_mode: 'county', default_delivery_fee: 0, deposit_percent: null }

// Tables whose changes make every open page re-read the storefront.
const WATCH = [
  { table: 'store_settings' }, { table: 'products' }, { table: 'product_variants' }, { table: 'product_images' },
  { table: 'categories' }, { table: 'delivery_locations' }, { table: 'site_media' },
]

export function StoreProvider({ children }) {
  const [data, setData] = useState({ settings: BEFORE_FIRST_LOAD, categories: [], locations: [], products: [], media: [] })
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const started = useRef(0)
  const applied = useRef(0)

  const reload = useCallback(async (silent = false) => {
    const mine = ++started.current
    if (!silent) setLoading(true)
    try {
      const d = await api.getStorefront()
      // Answers can arrive out of order. An older answer must never replace a newer one.
      if (mine < applied.current) return
      applied.current = mine
      setData({ ...d, settings: { ...BEFORE_FIRST_LOAD, ...d.settings } })
      setLoaded(true)
      setError('')
    } catch (e) {
      // a failed background refresh keeps what is on screen; a failed first load shows the error
      if (!silent || !applied.current) setError(friendlyError(e))
    } finally {
      if (mine >= applied.current || !silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Admin changed something (any device)? Realtime says so, the page re-reads the database.
  // Also refreshes on tab focus and on a timer in case Realtime is unavailable.
  useLiveRefresh(WATCH, () => reload(true))

  useEffect(() => {
    document.title = `${data.settings.business_name}${data.settings.tagline ? ` | ${data.settings.tagline}` : ''}`
  }, [data.settings.business_name, data.settings.tagline])

  const mediaPrimary = useMemo(() => {
    const out = {}
    ;(data.media || []).forEach((m) => {
      if (m.is_primary && !out[m.slot]) out[m.slot] = m
    })
    return out
  }, [data.media])

  // favicon + default product image come from Admin > Media
  useEffect(() => {
    setDefaultImages({ product: mediaPrimary.default_product?.url })
    const href = mediaPrimary.favicon?.url
    if (!href) return
    let link = document.querySelector('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.removeAttribute('type')
    link.href = href
  }, [mediaPrimary])

  const value = useMemo(() => {
    const mediaList = (slot) => (data.media || []).filter((m) => m.slot === slot)
    // `categories` is what customers see: a category with no customer-visible product is left out everywhere
    // (home, Browse by category, menus, filters, search). catById keeps every active category so that the
    // name of a visible product's category always resolves.
    const categories = visibleCategories(data.categories, data.products)
    const catById = Object.fromEntries(data.categories.map((c) => [c.id, c]))
    const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]))
    const counts = categoryCounts(data.products)
    const variantIndex = {}
    data.products.forEach((p) => p.variants.forEach((v) => (variantIndex[v.id] = { product: p, variant: v })))
    return { ...data, categories, categoryCounts: counts, catById, catBySlug, variantIndex, media: mediaPrimary, mediaList, loading, loaded, error, reload }
  }, [data, mediaPrimary, loading, loaded, error, reload])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
