import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api.js'
import { friendlyError } from '../../lib/errors.js'
import { useStore } from '../../context/StoreContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useLiveRefresh } from '../../lib/realtime.js'

const Ctx = createContext(null)
export const useAdmin = () => useContext(Ctx)

export function AdminProvider({ children }) {
  const store = useStore()
  const toast = useToast()
  const [data, setData] = useState({ categories: [], products: [], settings: {}, locations: [], media: [], cancelReasons: [], updateTemplates: [] })
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const knownOrders = useRef(null)

  const reload = useCallback(
    async ({ publicToo = true } = {}) => {
      try {
        const [d, o] = await Promise.all([api.adminLoad(), api.listOrders()])
        setData(d)
        setOrders(o)
        // a customer placed an order (on any device) while the admin has the dashboard open
        if (knownOrders.current) {
          const fresh = o.filter((x) => !knownOrders.current.has(x.id))
          if (fresh.length) toast.success(fresh.length === 1 ? `New order ${fresh[0].order_number} from ${fresh[0].customer_name}` : `${fresh.length} new orders received`)
        }
        knownOrders.current = new Set(o.map((x) => x.id))
        setError('')
        if (publicToo) store.reload(true)
      } catch (e) {
        setError(friendlyError(e))
      } finally {
        setLoading(false)
      }
    },
    [store.reload, toast], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    reload({ publicToo: false })
  }, [reload])

  // another admin device (or a customer) changed something: re-read everything from Supabase
  useLiveRefresh(
    [{ table: 'orders' }, { table: 'order_events' }, { table: 'products' }, { table: 'product_variants' }, { table: 'product_images' }, { table: 'categories' },
      { table: 'store_settings' }, { table: 'delivery_locations' }, { table: 'site_media' }],
    () => reload({ publicToo: false }),
  )

  // run an admin action with consistent error / success toasts
  const run = useCallback(
    async (fn, success) => {
      try {
        const r = await fn()
        if (success) toast.success(success)
        return r ?? true
      } catch (e) {
        toast.error(friendlyError(e))
        return false
      }
    },
    [toast],
  )

  const value = useMemo(() => {
    const catById = Object.fromEntries(data.categories.map((c) => [c.id, c]))
    return { ...data, orders, catById, loading, error, reload, run }
  }, [data, orders, loading, error, reload, run])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
