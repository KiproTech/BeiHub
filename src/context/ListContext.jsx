import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './StoreContext.jsx'
import { useAuth } from './AuthContext.jsx'
import { availability, variantTitle } from '../lib/format.js'
import { computeDeliveryFee, orderTotals } from '../lib/pricing.js'

const Ctx = createContext(null)
export const useList = () => useContext(Ctx)

const LIST_KEY = 'beihub.list.v1'
const CUSTOMER_KEY = 'beihub.customer.v1'
const EMPTY_CUSTOMER = { customer_name: '', phone: '', alternative_phone: '', whatsapp: '', customer_email: '', preferred_contact: 'phone', fulfilment_method: 'delivery', county: '', town: '', delivery_location: '', preferred_delivery_date: '', notes: '' }

const read = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null')
    return v ?? fallback
  } catch {
    return fallback
  }
}

export function ListProvider({ children }) {
  const { variantIndex, settings, locations, loaded } = useStore()
  const { user } = useAuth()
  const [items, setItems] = useState(() => read(LIST_KEY, []))
  const [customer, setCustomerState] = useState(() => ({ ...EMPTY_CUSTOMER, ...read(CUSTOMER_KEY, {}) }))

  useEffect(() => {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(items))
    } catch {
      /* ignore */
    }
  }, [items])
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer))
    } catch {
      /* ignore */
    }
  }, [customer])

  // Contact details typed on this device belong to whoever was logged in: forget them on log out.
  const hadUser = useRef(false)
  useEffect(() => {
    if (user) hadUser.current = true
    else if (hadUser.current) {
      hadUser.current = false
      setCustomerState({ ...EMPTY_CUSTOMER })
    }
  }, [user])

  const add = useCallback((variantId, qty = 1) => {
    setItems((list) => {
      const hit = list.find((i) => i.variantId === variantId)
      if (hit) return list.map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(100, i.qty + qty) } : i))
      return [...list, { variantId, qty }]
    })
  }, [])
  const setQty = useCallback((variantId, qty) => setItems((l) => l.map((i) => (i.variantId === variantId ? { ...i, qty: Math.max(1, Math.min(100, qty)) } : i))), [])
  const remove = useCallback((variantId) => setItems((l) => l.filter((i) => i.variantId !== variantId)), [])
  const clear = useCallback(() => setItems([]), [])
  const setCustomer = useCallback((patch) => setCustomerState((c) => ({ ...c, ...patch })), [])
  const resetCustomerNotes = useCallback(() => setCustomerState((c) => ({ ...c, notes: '', preferred_delivery_date: '' })), [])

  const value = useMemo(() => {
    const lines = items.map((i) => {
      const hit = variantIndex[i.variantId]
      if (!hit) return { variantId: i.variantId, qty: i.qty, missing: true, title: 'No longer available', unitPrice: 0, lineTotal: 0, canOrder: false, max: 0 }
      const { product, variant } = hit
      const av = availability(variant)
      const qty = av.canOrder ? Math.min(i.qty, av.max || i.qty) : i.qty
      return {
        variantId: i.variantId, qty, product, variant, title: variantTitle(product, variant), unitPrice: variant.price, previousPrice: variant.previous_price,
        lineTotal: variant.price * qty, canOrder: av.canOrder, max: av.max, availability: av,
        image: (product.images.find((m) => m.is_main) || product.images[0])?.url,
      }
    })
    const valid = lines.filter((l) => !l.missing && l.canOrder)
    const subtotal = valid.reduce((a, l) => a + l.lineTotal, 0)
    const pickup = customer.fulfilment_method === 'pickup'
    const deliveryPending = !pickup && (settings.delivery_mode === 'county' || settings.delivery_mode === 'town') && !customer.county
    const deliveryFee = pickup || deliveryPending ? 0 : computeDeliveryFee(settings, locations, customer.county, customer.town, subtotal)
    const totals = orderTotals(subtotal, deliveryFee, settings.deposit_percent)
    const count = items.reduce((a, i) => a + i.qty, 0)
    const hasProblems = lines.some((l) => l.missing || !l.canOrder)
    return { items, lines, valid, count, totals, customer, hasProblems, loadingCatalog: !loaded, add, setQty, remove, clear, setCustomer, resetCustomerNotes, deliveryPending }
  }, [items, variantIndex, settings, locations, customer, loaded, add, setQty, remove, clear, setCustomer, resetCustomerNotes])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
