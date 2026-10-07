import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from './AuthContext.jsx'
import { useLiveRefresh } from '../lib/realtime.js'

const Ctx = createContext(null)
export const useNotifications = () => useContext(Ctx)

// In-system notifications. Email / SMS / WhatsApp can be added later on the server side
// (see queue_notification() in supabase/beihub_migration.sql) without changing this file.
export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const uid = user?.id
  const [items, setItems] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!uid) {
      setItems([])
      setLoaded(false)
      return
    }
    try {
      setItems(await api.listNotifications())
      setError('')
    } catch {
      setError('Could not load notifications.')
    } finally {
      setLoaded(true)
    }
  }, [uid])

  useEffect(() => {
    reload()
  }, [reload])

  // new notification written by the database (admin changed an order)? Realtime tells us; timer + focus are the fallback.
  useLiveRefresh(uid ? [{ table: 'notifications', filter: `user_id=eq.${uid}` }] : [], reload, { enabled: !!uid })

  const markRead = useCallback(
    async (ids) => {
      setItems((l) => l.map((n) => (!ids || ids.includes(n.id) ? { ...n, is_read: true } : n)))
      try {
        await api.markNotificationsRead(ids)
      } catch {
        reload()
      }
    },
    [reload],
  )

  const value = useMemo(() => ({ items, unread: items.filter((n) => !n.is_read).length, loaded, error, reload, markRead }), [items, loaded, error, reload, markRead])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
