import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { friendlyError } from '../lib/errors.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const DEFAULT_SETTINGS = { business_name: 'BeiHub', tagline: 'Quality Products. Better Prices. Delivered.', deposit_percent: 50, delivery_mode: 'county', default_delivery_fee: 0 }

export function StoreProvider({ children }) {
  const [data, setData] = useState({ settings: DEFAULT_SETTINGS, categories: [], locations: [], products: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const last = useRef(0)

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const d = await api.getStorefront()
      setData({ ...d, settings: { ...DEFAULT_SETTINGS, ...d.settings } })
      setError('')
      last.current = Date.now()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // refresh prices when the customer comes back to the tab after a while
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - last.current > 60000) reload(true)
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [reload])

  useEffect(() => {
    document.title = `${data.settings.business_name} | ${data.settings.tagline || 'Online catalogue'}`
  }, [data.settings.business_name, data.settings.tagline])

  const value = useMemo(() => {
    const catById = Object.fromEntries(data.categories.map((c) => [c.id, c]))
    const catBySlug = Object.fromEntries(data.categories.map((c) => [c.slug, c]))
    const variantIndex = {}
    data.products.forEach((p) => p.variants.forEach((v) => (variantIndex[v.id] = { product: p, variant: v })))
    return { ...data, catById, catBySlug, variantIndex, loading, error, reload }
  }, [data, loading, error, reload])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
