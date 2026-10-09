import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { useNavigate } from '../lib/router.jsx'
import { useToast } from './ToastContext.jsx'
import { takeNext } from '../lib/nextPath.js'
import { useLiveRefresh } from '../lib/realtime.js'

const Ctx = createContext(null)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const toast = useToast()
  const handled = useRef(false)

  const refresh = useCallback(async () => {
    try {
      setUser(await api.getUser())
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    return api.onAuthChange(() => refresh())
  }, [refresh])

  // Returning from an email link (verify email / reset password / expired link)
  useEffect(() => {
    if (handled.current) return
    handled.current = true
    const ev = api.takeAuthEvent()
    if (!ev) return
    // The administrator invitation page handles its own link (a successful link signs the tab in; an expired one is explained on the page).
    // It must NOT be redirected to "email verified" / the login page.
    if (window.location.pathname === '/admin/accept-invite') {
      if (ev.type !== 'error') refresh()
      return
    }
    if (ev.type === 'recovery') {
      navigate('/reset-password', { replace: true })
    } else if (ev.type === 'error') {
      toast.error(ev.message)
      navigate('/login?expired=1', { replace: true })
    } else {
      toast.success('Email verified. You can now place orders.')
      refresh().then(() => navigate(takeNext() || '/account/orders', { replace: true }))
    }
  }, [navigate, toast, refresh])

  // Role / permissions are read from the database. If the Super Admin changes them (or suspends the account),
  // this tab notices within seconds (Realtime) or at the latest when it regains focus - no new login needed.
  useLiveRefresh(user ? [{ table: 'admin_permissions' }, { table: 'profiles', filter: `id=eq.${user.id}` }] : [], refresh, { enabled: !!user })

  const value = useMemo(
    () => ({
      user,
      loading,
      // These flags only decide what to SHOW. The database re-checks every request (RLS), so they grant nothing.
      role: user?.role || null,
      permissions: user?.permissions || [],
      isStaff: ['admin', 'super_admin'].includes(user?.role) && !user?.suspended,
      isSuperAdmin: user?.role === 'super_admin' && !user?.suspended,
      isAdmin: ['admin', 'super_admin'].includes(user?.role) && !user?.suspended,
      can: (perm) => !!user && !user.suspended && (user.role === 'super_admin' || (user.role === 'admin' && (user.permissions || []).includes(perm))),
      canAny: (perms) => !!user && !user.suspended && (user.role === 'super_admin' || (user.role === 'admin' && perms.some((x) => (user.permissions || []).includes(x)))),
      isVerified: !!user?.email_verified,
      refresh,
      signIn: async (email, password) => {
        const u = await api.signIn(email.trim(), password)
        setUser(u)
        return u
      },
      signUp: (email, password, meta) => api.signUp(email.trim(), password, meta),
      resendVerification: (email) => api.resendVerification(email.trim()),
      recoverPassword: (email) => api.recoverPassword(email.trim()),
      updatePassword: (pw) => api.updatePassword(pw),
      // re-check with the server whether the emailed link has been clicked (e.g. in another tab)
      checkVerified: async () => {
        const ok = await api.checkVerified()
        await refresh()
        return ok
      },
      updateProfile: async (patch) => {
        await api.updateProfile(patch)
        await refresh()
      },
      signOut: async () => {
        await api.signOut()
        setUser(null)
      },
    }),
    [user, loading, refresh],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
