import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { friendlyError } from '../../lib/errors.js'
import { useStore } from '../../context/StoreContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

const Ctx = createContext(null)
export const useAdmin = () => useContext(Ctx)

export function AdminProvider({ children }) {
  const store = useStore()
  const toast = useToast()
  const [data, setData] = useState({ categories: [], products: [], settings: {}, locations: [] })
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(
    async ({ publicToo = true } = {}) => {
      try {
        const [d, o] = await Promise.all([api.adminLoad(), api.listOrders()])
        setData(d)
        setOrders(o)
        setError('')
        if (publicToo) store.reload(true)
      } catch (e) {
        setError(friendlyError(e))
      } finally {
        setLoading(false)
      }
    },
    [store.reload], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    reload({ publicToo: false })
  }, [reload])

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
